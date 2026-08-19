// engine.js — BotEngine: pure function frame evaluator
// Ported from jeremy-prt/bloub src/bot/engine.ts
// Applies liveliness (gaze wander, breathing, drift, blink calendar)

import { lerp, clamp, easings, r2 } from './math.js'
import { blend, toPoints, closedPath, capsulePath, radiusAtAngle } from './shape.js'
import { blinkScale, liveliness, eyePoses, EYE_SPLIT } from './face.js'
import { arcRender } from './decor.js'
import { RAYON } from './repere.js'
import { STATE_BY_ID } from './states.js'

const POINTS_CACHE = Array.from({ length: 64 }, () => ({ x: 0, y: 0 }))

/**
 * No external look target: the state's own pose commands the gaze, and the
 * resting drift lives on (`wander: 1`).
 */
const NO_LOOK = { yaw: 0, pitch: 10, mix: 0, spin: 0, wander: 1 }

function lerpEye(a, b, t) {
  return {
    w: lerp(a.w, b.w, t),
    h: lerp(a.h, b.h, t),
    open: lerp(a.open, b.open, t),
    tilt: lerp(a.tilt ?? 0, b.tilt ?? 0, t)
  }
}

/** Blend two poses. Decor crossfades in opacity, not geometry. */
function blendPose(a, b, t) {
  const out = 1 - t
  return {
    sil: blend(a.sil, b.sil, t),
    offX: lerp(a.offX, b.offX, t),
    offY: lerp(a.offY, b.offY, t),
    gaze: {
      yaw: lerp(a.gaze.yaw, b.gaze.yaw, t),
      pitch: lerp(a.gaze.pitch, b.gaze.pitch, t),
      roll: lerp(a.gaze.roll, b.gaze.roll, t)
    },
    split: lerp(a.split, b.split, t),
    eyes: [lerpEye(a.eyes[0], b.eyes[0], t), lerpEye(a.eyes[1], b.eyes[1], t)],
    eyeAlpha: lerp(a.eyeAlpha, b.eyeAlpha, t),
    bodyAlpha: lerp(a.bodyAlpha, b.bodyAlpha, t),
    dots: [
      ...a.dots.map(d => ({ ...d, opacity: d.opacity * out })),
      ...b.dots.map(d => ({ ...d, opacity: d.opacity * t }))
    ],
    arcs: [
      ...a.arcs.map(r => ({ ...r, id: `a${r.id}`, opacity: r.opacity * out })),
      ...b.arcs.map(r => ({ ...r, id: `b${r.id}`, opacity: r.opacity * t }))
    ],
    notif: t < 0.5 ? a.notif : b.notif,
    dotsBehind: t < 0.5 ? a.dotsBehind : b.dotsBehind
  }
}

/**
 * Pose of a state at local time `t`, with the current body shape and rest
 * expression laid over it.
 * Only `baseBody` states take the chosen shape: on the others the silhouette
 * IS the measured animation and must not be overwritten. Same for `baseFace`
 * and the rest expression (bloub `posed()`).
 */
function posed(def, t, expression, shapeRadii) {
  let pose = def.pose(t)
  if (def.baseBody && shapeRadii) {
    pose = { ...pose, sil: { ...pose.sil, radii: shapeRadii } }
  }
  if (def.baseFace && expression) {
    pose = { ...pose, gaze: expression.gaze, split: expression.split, eyes: expression.eyes }
  }
  return pose
}

/**
 * @param {string} stateId      current state id
 * @param {number} localTime    seconds since the state started
 * @param {object} look         { yaw, pitch, mix, spin, wander } — see bloub `Look`
 * @param {string} prevStateId  state being morphed away from (or null)
 * @param {number} morphT       morph progress 0..1
 * @param {object} expression   rest expression (expressions.js), pre-blended
 * @param {number[]} shapeRadii current body profile (shapes.js), pre-blended
 */
export function sampleFrame(stateId, localTime, look, prevStateId, morphT, expression = null, shapeRadii = null, scale = RAYON) {
  const state = STATE_BY_ID[stateId]
  if (!state) return null

  let pose = posed(state, localTime, expression, shapeRadii)

  // Morph from previous state if in transition
  let morphedPose = pose
  if (prevStateId && morphT < 1) {
    const prevState = STATE_BY_ID[prevStateId]
    if (prevState) {
      const prevPose = posed(prevState, prevState.duration ?? 0, expression, shapeRadii)
      const easedT = easings.easeOutQuint(clamp(morphT))
      morphedPose = blendPose(prevPose, pose, easedT)
    }
  }

  const L = look ?? NO_LOOK

  // --- liveliness (gaze wander, blink, breathing, drift) ---
  // `wander` is what remains of automatic drift: it dies while the pointer
  // commands the gaze, and comes back when there is no pointer.
  const alive = morphedPose.eyeAlpha > 0.01
  const life = liveliness(localTime, {
    wander: alive ? L.wander : 0,
    blink: alive,
    float: true
  })

  // Gaze: the look REPLACES the pose's own as `mix` rises (absolute on both
  // axes). The drift is added AFTER the mix so it survives a turned head, and
  // `spin` is a full turn taken on the way (free on a sphere: -360deg == 0).
  const finalGaze = {
    yaw: lerp(morphedPose.gaze.yaw, L.yaw, L.mix) + life.dYaw - (L.spin ?? 0),
    pitch: lerp(morphedPose.gaze.pitch, L.pitch, L.mix) + life.dPitch,
    // roll follows nothing: the -13deg head tilt is a signature of the bot
    roll: (morphedPose.gaze.roll ?? -13) + life.dRoll
  }

  // In the video every shape change is masked by a blink: `blinkIn` states
  // dip the lids in the first 0.2 s after entry.
  let lid = life.lid
  if (state.blinkIn) {
    const forced = clamp(localTime / 0.2)
    if (forced < 1) lid = Math.min(lid, Math.abs(forced * 2 - 1))
  }

  // Apply body breathing and drift
  const offX = morphedPose.offX + life.driftX
  const offY = morphedPose.offY + life.driftY
  const sil = {
    ...morphedPose.sil,
    cx: morphedPose.sil.cx + offX,
    cy: morphedPose.sil.cy + offY,
    sy: morphedPose.sil.sy * life.breath
  }

  // Build SVG body path
  const pts = toPoints(sil, scale, POINTS_CACHE)
  const bodyPath = closedPath(pts)

  // Radius lookup for eye positioning on non-circular shapes
  const bodyRadius = (x, y) =>
    radiusAtAngle(morphedPose.sil.radii, Math.atan2(y, x) - morphedPose.sil.rot)

  // Build eye data using accurate 3D tangent matrix & capsule path
  const totalEyeAlpha = morphedPose.eyeAlpha ?? 1
  const eyes = totalEyeAlpha <= 0 ? [] : morphedPose.eyes.map((eyeCfg, i) => {
    const poses = eyePoses(finalGaze, scale, morphedPose.split ?? EYE_SPLIT)
    const e = poses[i]
    if (!e || e.depth <= 0.02) return null

    const cfg = eyeCfg
    const fit = bodyRadius(e.x, e.y)

    // Eye tilt: compose tangent basis with in-plane rotation
    const phi = ((cfg.tilt ?? 0) * Math.PI) / 180
    const cp = Math.cos(phi)
    const sp = Math.sin(phi)
    const ax = e.a * cp + e.c * sp
    const ay = e.b * cp + e.d * sp
    const cx2 = -e.a * sp + e.c * cp
    const cy2 = -e.b * sp + e.d * cp

    // Blink is vertical screen-space crush, applied after the tangent matrix
    const k = blinkScale(Math.min(lid, cfg.open ?? 1))

    const hw = Math.max((cfg.w ?? 0.186) * scale, 0.5) / 2
    const hh = Math.max((cfg.h ?? 0.412) * scale, 0.5) / 2

    return {
      d: capsulePath(hw * 2, hh * 2),
      matrix: `matrix(${r2(ax)},${r2(ay * k)},${r2(cx2)},${r2(cy2 * k)},${r2(e.x * fit + offX * scale)},${r2(e.y * fit + offY * scale)})`,
      alpha: totalEyeAlpha * clamp(e.depth / 0.12)
    }
  }).filter(Boolean)

  // Build decoration dots (in viewBox units)
  const dots = (morphedPose.dots ?? [])
    .filter(p => p.opacity > 0.01 && p.r > 0.0005)
    .map(d => ({
      ...d,
      x: (d.x + offX) * scale,
      y: (d.y + offY) * scale,
      r: d.r * scale
    }))

  // Build arcs — use the new arcRender system if arcs have the seed format
  const arcs = (morphedPose.arcs ?? [])
    .filter(a => a.opacity > 0.01)
    .map(a => {
      if (a.seed) {
        // New-style arc with ArcSeed — full 3D rendering
        return arcRender(a.seed, a.t, scale, a.id, a.opacity)
      }
      // Legacy fallback (simple arc path)
      return a
    })

  // Notification badge + the notch it bites out of the body
  const notif = morphedPose.notif ? {
    x: morphedPose.notif.x * scale + offX * scale,
    y: morphedPose.notif.y * scale + offY * scale,
    r: morphedPose.notif.r * scale
  } : null
  const notch = morphedPose.notif?.notch ? {
    x: morphedPose.notif.x * scale + offX * scale,
    y: morphedPose.notif.y * scale + offY * scale,
    r: morphedPose.notif.notch * scale
  } : null

  return {
    bodyPath,
    bodyAlpha: morphedPose.bodyAlpha ?? 1,
    offX: offX * scale,
    offY: offY * scale,
    eyes,
    dots,
    dotsBehind: morphedPose.dotsBehind ?? false,
    arcs,
    notif,
    notch,
  }
}
