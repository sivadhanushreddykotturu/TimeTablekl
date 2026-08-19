// BloubBot.jsx — SVG rendering React component
// Renders the bloub engine output at 60fps via requestAnimationFrame
// Supports 3D arc rendering with depth-sorted front/back paths and color gradients

import React, { useEffect, useRef, useState, useMemo } from 'react'
import { sampleFrame } from './engine.js'
import { RAYON, DEMI_VIEWBOX } from './repere.js'
import { STATE_BY_ID } from './states.js'
import { lerp, clamp, easings } from './math.js'
import { blendExpression } from './expressions.js'

const VB = DEMI_VIEWBOX
const VIEWBOX = `${-VB} ${-VB} ${VB * 2} ${VB * 2}`

const MORPH_DURATION = 0.45 // seconds
/** Duration of the full eye turn played when the big stage opens (bloub TURN_TIME). */
const TURN_TIME = 1.1
const SPIN = 360
/** Rest expression glide duration (bloub SHAPE_MORPH). */
const EXPR_MORPH = 0.45
/** Body shape glide duration (bloub SHAPE_MORPH). */
const SHAPE_MORPH = 0.45

const NO_LOOK = { yaw: 0, pitch: 10, mix: 0, wander: 1 }

/**
 * BloubBot — animated SVG mascot
 * Props:
 *   stateId      - the current animation state ID
 *   size         - SVG width/height in px (default 240)
 *   lookRef      - ref holding the gaze TARGET { yaw, pitch, mix, wander };
 *                  caught up with exponential inertia, bloub LOOK_MORPH style
 *   spinFrom     - seconds epoch (performance.now()/1000) when the entrance
 *                  eye-turn began, or null
 *   expression   - rest expression object (expressions.js) or null; glides
 *   shapeRadii   - body profile (shapes.js) or null for the plain ball; glides
 *   eyePosRef    - optional ref: receives the live eye centers (viewBox units)
 *   ink          - body color (default '#161622')
 *   eyeColor     - eye capsule color (default '#ffffff')
 *   decorColor   - color for dots when no explicit color (default '#ffffff')
 *   paper        - bg color (default 'transparent')
 */
export default function BloubBot({
  stateId = 'idle',
  size = 240,
  lookRef = null,
  spinFrom = null,
  expression = null,
  shapeRadii = null,
  eyePosRef = null,
  ink = '#161622',
  eyeColor = '#ffffff',
  decorColor = '#ffffff',
  paper = 'transparent',
  style = {}
}) {
  const rafRef = useRef(null)
  const startTimeRef = useRef(null)
  const stateStartRef = useRef(null)
  const prevStateRef = useRef(null)
  const morphStartRef = useRef(null)
  const currentStateRef = useRef(stateId)
  const lastTickRef = useRef(null)

  // Smoothed look (starts at rest: no external command, drift alive)
  const lookCurRef = useRef({ ...NO_LOOK })
  const spinFromRef = useRef(spinFrom)
  useEffect(() => { spinFromRef.current = spinFrom }, [spinFrom])

  // Rest expression glide: remember where we come from and when it started
  const exprTargetRef = useRef(expression)
  const exprPrevRef = useRef(null)
  const exprAtRef = useRef(0)
  const exprCurRef = useRef(expression)

  // Body shape glide: same timestamped-boundary pattern as the expression
  const shapeTargetRef = useRef(shapeRadii)
  const shapePrevRef = useRef(null)
  const shapeAtRef = useRef(0)
  const shapeCurRef = useRef(shapeRadii)
  useEffect(() => {
    if (shapeRadii === shapeTargetRef.current) return
    shapePrevRef.current = shapeCurRef.current
    shapeTargetRef.current = shapeRadii
    shapeAtRef.current = performance.now() / 1000
  }, [shapeRadii])
  useEffect(() => {
    if (expression === exprTargetRef.current) return
    exprPrevRef.current = exprCurRef.current
    exprTargetRef.current = expression
    exprAtRef.current = performance.now() / 1000
  }, [expression])

  const [frame, setFrame] = useState(() =>
    sampleFrame(stateId, 0, null, null, 1, expression, RAYON)
  )

  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), [])

  const stateIdRef = useRef(stateId)

  // Handle state transitions
  useEffect(() => {
    stateIdRef.current = stateId
    if (stateId !== currentStateRef.current) {
      prevStateRef.current = currentStateRef.current
      morphStartRef.current = performance.now() / 1000
      currentStateRef.current = stateId
      stateStartRef.current = performance.now() / 1000
    }
  }, [stateId])

  // rAF loop
  useEffect(() => {
    startTimeRef.current = performance.now() / 1000
    stateStartRef.current = startTimeRef.current
    currentStateRef.current = stateId
    lastTickRef.current = startTimeRef.current

    const tick = () => {
      const nowSec = performance.now() / 1000
      const dt = Math.min(Math.max(nowSec - (lastTickRef.current ?? nowSec), 0.001), 0.1)
      lastTickRef.current = nowSec
      const localTime = nowSec - (stateStartRef.current ?? nowSec)

      // Auto-advance or loop state based on duration
      const targetState = stateIdRef.current || 'idle'
      const state = STATE_BY_ID[currentStateRef.current]
      if (state && localTime > state.duration) {
        if (targetState === 'thinking' || targetState === 'sleep' || targetState === 'notify') {
          // Loop continuous state (notify re-pops its badge each pass: a pulse)
          stateStartRef.current = nowSec
        } else if (currentStateRef.current !== 'idle') {
          prevStateRef.current = currentStateRef.current
          currentStateRef.current = 'idle'
          morphStartRef.current = nowSec
          stateStartRef.current = nowSec
        } else {
          stateStartRef.current = nowSec
        }
      }

      // Morph transition progress
      const morphElapsed = morphStartRef.current ? nowSec - morphStartRef.current : 1
      const morphT = Math.min(morphElapsed / MORPH_DURATION, 1)

      // Gaze catch-up: exponential approach to the target, so the look never
      // quite reaches a moving cursor — that's the tracking's inertia.
      const tgt = lookRef?.current ?? NO_LOOK
      const k = 1 - Math.exp(-dt / 0.12)
      const cur = lookCurRef.current
      cur.yaw = lerp(cur.yaw, tgt.yaw ?? 0, k)
      cur.pitch = lerp(cur.pitch, tgt.pitch ?? 10, k)
      cur.mix = lerp(cur.mix, tgt.mix ?? 0, k)
      cur.wander = lerp(cur.wander, tgt.wander ?? 1, k)
      // The entrance turn is read off the clock, not smoothed: it is a
      // rotation, not a value coming to rest.
      const sf = spinFromRef.current
      const spin = sf
        ? SPIN * (1 - easings.easeOutQuint(clamp((nowSec - sf) / TURN_TIME)))
        : 0
      const look = { yaw: cur.yaw, pitch: cur.pitch, mix: cur.mix, wander: cur.wander, spin }

      // Rest expression glide
      let expr = exprTargetRef.current
      const ep = exprPrevRef.current
      if (ep && expr) {
        const ke = clamp((nowSec - exprAtRef.current) / EXPR_MORPH)
        if (ke < 1) expr = blendExpression(ep, expr, easings.easeOutQuint(ke))
      }
      exprCurRef.current = expr

      // Body shape glide (radii interpolated only while the morph runs)
      let radii = shapeTargetRef.current
      const sp = shapePrevRef.current
      if (sp && radii && sp !== radii) {
        const ks = clamp((nowSec - shapeAtRef.current) / SHAPE_MORPH)
        if (ks < 1) {
          const ts = easings.easeOutQuint(ks)
          radii = radii.map((r, i) => lerp(sp[i] ?? r, r, ts))
        }
      }
      shapeCurRef.current = radii

      const f = sampleFrame(
        currentStateRef.current,
        localTime,
        look,
        prevStateRef.current,
        morphT,
        expr,
        radii,
        RAYON
      )

      if (f) {
        setFrame(f)
        if (eyePosRef) {
          eyePosRef.current = f.eyes.map((e) => ({ x: e.x, y: e.y }))
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!frame) return null

  const { bodyPath, bodyAlpha, eyes, dots, dotsBehind, arcs, notif, notch } = frame
  const clipId = `bot-clip-${uid}`
  const maskId = `bot-mask-${uid}`

  return (
    <svg
      width={size}
      height={size}
      viewBox={VIEWBOX}
      style={{ display: 'block', overflow: 'visible', background: paper, ...style }}
      aria-hidden="true"
    >
      <defs>
        {/* Eyes are clipped to the silhouette: sliding to the edge crops them
            against the body instead of letting them float outside it. */}
        <clipPath id={clipId}>
          <path d={bodyPath} />
        </clipPath>

        {/* The notification pastille bites a real notch out of the body. */}
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x={-VB}
          y={-VB}
          width={VB * 2}
          height={VB * 2}
        >
          <path d={bodyPath} fill="#fff" />
          {notch && <circle cx={notch.x} cy={notch.y} r={notch.r} fill="#000" />}
        </mask>

        {/* Gradient definitions for arc colors */}
        {arcs.map((arc, i) => arc.grad && (
          <linearGradient
            key={`grad-${uid}-${arc.id || i}`}
            id={`arc-grad-${uid}-${arc.id || i}`}
            x1={arc.grad.x1} y1={arc.grad.y1}
            x2={arc.grad.x2} y2={arc.grad.y2}
            gradientUnits="userSpaceOnUse"
          >
            {arc.grad.stops.map((stop, j) => (
              <stop key={j} offset={`${(j / (arc.grad.stops.length - 1)) * 100}%`} stopColor={stop} />
            ))}
          </linearGradient>
        ))}
      </defs>

      {/* Background fill */}
      {paper !== 'transparent' && (
        <rect x={-VB} y={-VB} width={VB * 2} height={VB * 2} fill={paper} />
      )}

      {/* Arcs BEHIND body (back portions of 3D arcs) */}
      {arcs.map((arc, i) => arc.back && (
        <path
          key={`arc-back-${arc.id || i}`}
          d={arc.back}
          stroke={arc.grad ? `url(#arc-grad-${uid}-${arc.id || i})` : decorColor}
          strokeWidth={arc.width || Math.max(arc.strokeWidth || 0, 3)}
          fill="none"
          opacity={arc.opacity * 0.5}
          strokeLinecap="round"
        />
      ))}

      {/* Dots behind body (burst particles) */}
      {dotsBehind && dots.map((d, i) => (
        <circle
          key={`dot-b-${i}`}
          cx={d.x}
          cy={d.y}
          r={Math.max(d.r, 2)}
          fill={d.color || ink}
          opacity={d.opacity}
        />
      ))}

      {/* Body (the notif notch is cut out by the mask) — no outline */}
      <g opacity={bodyAlpha}>
        <g mask={`url(#${maskId})`}>
          <path d={bodyPath} fill={ink} />
        </g>
      </g>

      {/* Eyes (capsule paths with 3D tangent matrix, cropped by the body) */}
      <g clipPath={`url(#${clipId})`}>
        {eyes.map((eye, i) => eye && (
          <path
            key={`eye-${i}`}
            d={eye.d}
            transform={eye.matrix}
            fill={eyeColor}
            opacity={eye.alpha ?? 1}
          />
        ))}
      </g>

      {/* Arcs IN FRONT of body (front portions of 3D arcs) */}
      {arcs.map((arc, i) => {
        const pathD = arc.front || arc.d
        if (!pathD) return null
        return (
          <path
            key={`arc-front-${arc.id || i}`}
            d={pathD}
            stroke={arc.grad ? `url(#arc-grad-${uid}-${arc.id || i})` : decorColor}
            strokeWidth={arc.width || Math.max(arc.strokeWidth || 0, 3)}
            fill="none"
            opacity={arc.opacity * 0.75}
            strokeLinecap="round"
          />
        )
      })}

      {/* Dots in front (orbiting satellite / thinking dots / burst particles) */}
      {!dotsBehind && dots.map((d, i) => {
        if (d.d) {
          // Custom shape (teardrop for alert dot)
          return (
            <path
              key={`dot-f-${i}`}
              d={d.d}
              transform={`translate(${d.x},${d.y})${d.rot ? ` rotate(${d.rot})` : ''} scale(${RAYON})`}
              fill={d.color || ink}
              opacity={d.opacity}
            />
          )
        }
        return (
          <circle
            key={`dot-f-${i}`}
            cx={d.x}
            cy={d.y}
            r={Math.max(d.r, 2)}
            fill={d.color || decorColor}
            opacity={d.opacity}
          />
        )
      })}

      {/* Notification badge: solid blue dot sitting in its notch */}
      {notif && (
        <circle cx={notif.x} cy={notif.y} r={notif.r} fill="#2496e8" />
      )}
    </svg>
  )
}
