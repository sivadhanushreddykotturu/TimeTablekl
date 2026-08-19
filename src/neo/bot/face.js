import { clamp, createRng, loopNoise } from './math.js'

/**
 * Eyes are painted on a sphere, not laid flat.
 *
 * Measured on the video: the eye closest to the edge is 0.69 times the width
 * of the other, and its area 0.663 times — exactly the depth factor
 * (z = 0.669) of a sphere point at this distance from the center. So we model
 * a real head orientation: each eye gets the tangent frame of the sphere,
 * orthographically projected. Compression and tilt follow naturally,
 * giving the volume.
 *
 * The constants below are not hand-picked: they come from fitting the model
 * to positions and sizes extracted frame by frame (residual error ~1 px on
 * a 190 px radius).
 */

/** Half-split of eyes on the sphere, in degrees (total separation ~31deg). */
export const EYE_SPLIT = 15.46
/** Size of the eye at rest, in units of sphere radius. */
export const EYE_W = 0.186
export const EYE_H = 0.412

/** Head orientation at rest, adjusted on reference frames. */
export const REST_GAZE = { yaw: 28.49, pitch: 28.62, roll: -13 }

const deg = (d) => (d * Math.PI) / 180

/** Rotates two vectors of an orthonormal basis in their common plane. */
function spin(u, v, angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [
    [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s],
    [v[0] * c - u[0] * s, v[1] * c - u[1] * s, v[2] * c - u[2] * s]
  ]
}

/**
 * Frame of the head then of the two eyes.
 * Screen frame: x right, y down, z towards viewer.
 * Index 0 is inner eye, index 1 is outer eye.
 */
export function eyePoses(gaze, scale, split = EYE_SPLIT) {
  let f = [0, 0, 1]
  let right = [1, 0, 0]
  let down = [0, 1, 0]

  // yaw: forward tilts to right
  ;[f, right] = spin(f, right, deg(gaze.yaw))
  // pitch: forward tilts up (so opposite to down)
  ;[down, f] = spin(down, f, deg(gaze.pitch))
  // roll: head tilts in its own plane
  ;[right, down] = spin(right, down, deg(gaze.roll))

  const build = (side) => {
    const [ef, er] = spin(f, right, deg(split * side))
    return {
      x: ef[0] * scale,
      y: ef[1] * scale,
      a: er[0],
      b: er[1],
      c: down[0],
      d: down[1],
      depth: ef[2]
    }
  }

  return [build(-1), build(1)]
}

/**
 * Life at rest: slow gaze drift, saccades, blinks.
 *
 * Pure function of time (no internal state), so pause, resume and jump to
 * arbitrary time always yield the same image. Values are DELTAS to be added
 * to the current state's pose.
 */
const BLINK_RNG = createRng(0x5eed)
/** Pre-rolled blink calendar: deterministic and stateless. */
const BLINKS = (() => {
  const out = []
  let t = 1.4
  while (t < 900) {
    out.push(t)
    // 1.9 to 4.6 s between two blinks, plus an occasional double blink
    t += 1.9 + BLINK_RNG() * 2.7
    if (BLINK_RNG() < 0.18) {
      out.push(t)
      t += 0.24
    }
  }
  return out
})()

/** Measurement: 1 to 2 frames at 10 fps. */
const BLINK_DUR = 0.18

function blinkLid(t) {
  for (let i = 0; i < BLINKS.length; i++) {
    const start = BLINKS[i]
    if (t < start) break
    const k = (t - start) / BLINK_DUR
    if (k >= 0 && k <= 1) {
      // quick closing, slightly slower reopening
      return k < 0.45 ? 1 - k / 0.45 : (k - 0.45) / 0.55
    }
  }
  return 1
}

export function liveliness(t, opt = {}) {
  const { wander = 1, blink = true, float = true } = opt

  // Co-prime periods: drift never visually repeats.
  return {
    dYaw: (loopNoise(t, 11.3, 0.4) * 5.5 + loopNoise(t, 3.7, 2.1) * 1.6) * wander,
    dPitch: (loopNoise(t, 9.1, 1.3) * 4.2 + loopNoise(t, 4.3, 0.7) * 1.3) * wander,
    dRoll: loopNoise(t, 13.7, 3.2) * 2.2 * wander,
    lid: blink ? blinkLid(t) : 1,
    // At rest the video is almost still (center stable at +-0.003, radius
    // constant): all life comes from gaze and blinks. We just keep enough
    // to not completely freeze the image.
    driftX: float ? loopNoise(t, 7.9, 1.9) * 0.006 : 0,
    driftY: float ? loopNoise(t, 5.3, 0.3) * 0.007 : 0,
    // Width is constant, only height breathes very slightly.
    breath: float ? 1 + Math.sin((t / 3.4) * Math.PI * 2) * 0.005 : 1
  }
}

/**
 * Blinking is a VERTICAL squash in screen space around the eye's center
 * (measurement: bbox width is preserved, height drops to ~0.35),
 * not a shrinking along the capsule's tilted axis. So we compose it
 * after the tangent matrix, affecting only the y outputs.
 */
export function blinkScale(lid) {
  return 0.06 + 0.94 * clamp(lid)
}
