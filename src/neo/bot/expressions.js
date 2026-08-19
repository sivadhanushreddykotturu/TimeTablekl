import { EYE_H, EYE_SPLIT, EYE_W, REST_GAZE } from './face.js'
import { lerp } from './math.js'

/**
 * Bot's rest expression.
 *
 * The face relies on two capsules, so everything plays out on four levers:
 * head orientation, eye split, their proportions, and the individual tilt of
 * each eye. This last one allows for anger and sadness: they require MIRRORED
 * tilts (tops converging or diverging), impossible with just head roll which
 * tilts both eyes to the same side.
 *
 * Only the rest state carries this expression. The expressive states from the video
 * (wink, wide eyes, notification) keep theirs: that's what we came to reproduce.
 *
 * Amplitudes are based on bible-strong-avatar-lab, which exposes the same
 * model (head X/Y/Z, width and height per eye, split, angle per eye): there
 * width goes from 0.8 to 2.7 times neutral, height from 0.3 to 1.5, and
 * angles up to ±80°. We stay within this envelope.
 */

/** `tilt` in degrees, positive = top of capsule tilts right. */
const eye = (w, h, tilt = 0, open = 1) => ({ w, h, tilt, open })

/** Two identical eyes, mirrored tilts if `tilt` is provided. */
const pair = (w, h, tilt = 0, open = 1) => [
  eye(w, h, tilt, open),
  eye(w, h, -tilt, open)
]

export const EXPRESSIONS = {
  neutral: {
    // pose extracted frame by frame from reference video
    id: 'neutral',
    gaze: { ...REST_GAZE },
    split: EYE_SPLIT,
    eyes: [eye(EYE_W, EYE_H), eye(EYE_W, EYE_H)]
  },
  attentive: {
    id: 'attentive',
    gaze: { yaw: 4, pitch: 5, roll: -4 },
    split: 16,
    eyes: pair(0.21, 0.44)
  },
  surprised: {
    id: 'surprised',
    gaze: { yaw: 3, pitch: -3, roll: 0 },
    split: 19,
    eyes: pair(0.45, 0.47)
  },
  excited: {
    id: 'excited',
    gaze: { yaw: 6, pitch: -14, roll: 0 },
    split: 19.5,
    eyes: pair(0.4, 0.56, -10)
  },
  happy: {
    // eyes squinted in an arc: tops converge slightly
    id: 'happy',
    gaze: { yaw: 5, pitch: 9, roll: 0 },
    split: 17,
    eyes: pair(0.27, 0.17, 14)
  },
  laughing: {
    id: 'laughing',
    gaze: { yaw: 4, pitch: 14, roll: 0 },
    split: 18,
    eyes: pair(0.34, 0.13, 20)
  },
  angry: {
    // eye tops converging strongly towards center + narrowed eyes
    id: 'angry',
    gaze: { yaw: 3, pitch: 7, roll: 0 },
    split: 17,
    eyes: pair(0.34, 0.15, 30)
  },
  sad: {
    // the opposite: tops diverge, and gaze falls
    id: 'sad',
    gaze: { yaw: 3, pitch: -13, roll: 0 },
    split: 16,
    eyes: pair(0.22, 0.4, -28)
  },
  scared: {
    id: 'scared',
    gaze: { yaw: 2, pitch: -20, roll: 0 },
    split: 20.5,
    eyes: pair(0.4, 0.6)
  },
  suspicious: {
    // one eye visibly more closed than the other
    id: 'suspicious',
    gaze: { yaw: 12, pitch: 6, roll: -6 },
    split: 16,
    eyes: [eye(0.21, 0.4), eye(0.22, 0.15)]
  },
  confused: {
    // asymmetric on both axes: sizes AND tilts mismatched.
    // The squinting eye is deliberately flat (ratio 1.6): at a ratio close
    // to 1 it would be round, and its tilt wouldn't show.
    id: 'confused',
    gaze: { yaw: -14, pitch: 3, roll: 8 },
    split: 16.5,
    eyes: [eye(0.2, 0.44, -18), eye(0.28, 0.17, 14)]
  },
  curious: {
    // head tilts: roll carries the curiosity
    id: 'curious',
    gaze: { yaw: 16, pitch: -9, roll: -15 },
    split: 16.5,
    eyes: [eye(0.24, 0.46, -8), eye(0.2, 0.38, -8)]
  },
  proud: {
    id: 'proud',
    gaze: { yaw: 5, pitch: 17, roll: 0 },
    split: 17,
    eyes: pair(0.3, 0.15, 18)
  },
  shy: {
    id: 'shy',
    gaze: { yaw: -19, pitch: -14, roll: -7 },
    split: 14,
    eyes: pair(0.17, 0.3)
  },
  unimpressed: {
    // horizontal slits and gaze looking to the side
    id: 'unimpressed',
    gaze: { yaw: -22, pitch: 2, roll: 0 },
    split: 16,
    eyes: pair(0.3, 0.12)
  },
  sleepy: {
    // eyelids half drooped: we use `open`, thus the vertical
    // squash on screen, same mechanism as blinking
    id: 'sleepy',
    gaze: { yaw: 6, pitch: -9, roll: -3 },
    split: 16,
    eyes: pair(0.2, 0.42, 0, 0.42)
  }
}

export const DEFAULT_EXPRESSION = 'neutral'

const lerpEyeCfg = (a, b, t) => ({
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
  tilt: lerp(a.tilt ?? 0, b.tilt ?? 0, t),
  open: lerp(a.open, b.open, t)
})

/** Interpolation of two expressions: the change happens by gliding. */
export function blendExpression(a, b, t) {
  return {
    id: b.id,
    gaze: {
      yaw: lerp(a.gaze.yaw, b.gaze.yaw, t),
      pitch: lerp(a.gaze.pitch, b.gaze.pitch, t),
      roll: lerp(a.gaze.roll, b.gaze.roll, t)
    },
    split: lerp(a.split, b.split, t),
    eyes: [lerpEyeCfg(a.eyes[0], b.eyes[0], t), lerpEyeCfg(a.eyes[1], b.eyes[1], t)]
  }
}
