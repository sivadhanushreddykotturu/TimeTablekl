// eyefit.js — Exact capsule path and 3D tangent matrix projection matching bloub
// Ported from jeremy-prt/bloub src/bot/eyefit.ts

import { r2 } from './math.js'
import { RAYON } from './repere.js'
import { eyePoses, EYE_SPLIT } from './face.js'

/**
 * Capsule path generator supporting both vertical and horizontal orientations.
 * Matches bloub SVG output:
 * - Vertical: M -r -dy A r r 0 0 1 0 -hh L 0 -hh A r r 0 0 1 r -dy L r dy A r r 0 0 1 0 hh L 0 hh A r r 0 0 1 -r dy Z
 * - Horizontal: M -hw 0 A r r 0 0 1 -dx -r L dx -r A r r 0 0 1 hw 0 L hw 0 A r r 0 0 1 dx r L -dx r A r r 0 0 1 -hw 0 Z
 */
export function capsulePath(hw, hh) {
  if (hh >= hw) {
    const r = hw
    const dy = hh - r
    return `M${r2(-r)} ${r2(-dy)}A${r2(r)} ${r2(r)} 0 0 1 0 ${r2(-hh)}L0 ${r2(-hh)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(r)} ${r2(-dy)}L${r2(r)} ${r2(dy)}A${r2(r)} ${r2(r)} 0 0 1 0 ${r2(hh)}L0 ${r2(hh)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(-r)} ${r2(dy)}Z`
  } else {
    const r = hh
    const dx = hw - r
    return `M${r2(-hw)} 0A${r2(r)} ${r2(r)} 0 0 1 ${r2(-dx)} ${r2(-r)}L${r2(dx)} ${r2(-r)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(hw)} 0L${r2(hw)} 0A${r2(r)} ${r2(r)} 0 0 1 ${r2(dx)} ${r2(r)}L${r2(-dx)} ${r2(r)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(-hw)} 0Z`
  }
}

/**
 * Project a single eye onto the 3D sphere surface.
 * Returns { d, matrix, alpha }
 */
export function projectEye(gaze, side, eyeCfg, blinkFactor, scale = RAYON, split = EYE_SPLIT) {
  const poses = eyePoses(gaze, scale, split)
  const i = side === -1 ? 0 : 1
  const e = poses[i]
  if (!e || e.depth <= 0.02) return null

  const phi = ((eyeCfg.tilt ?? 0) * Math.PI) / 180
  const cp = Math.cos(phi)
  const sp = Math.sin(phi)
  const ax = e.a * cp + e.c * sp
  const ay = e.b * cp + e.d * sp
  const cx = -e.a * sp + e.c * cp
  const cy = -e.b * sp + e.d * cp

  const hw = Math.max((eyeCfg.w ?? 0.186) * scale, 0.5) / 2
  const hh = Math.max((eyeCfg.h ?? 0.412) * scale * (eyeCfg.open ?? 1) * Math.max(blinkFactor, 0.04), 0.5) / 2

  const d = capsulePath(hw, hh)
  const matrix = `matrix(${r2(ax)},${r2(ay)},${r2(cx)},${r2(cy)},${r2(e.x)},${r2(e.y)})`
  const alpha = Math.min(1, Math.max(0, (e.depth - 0.02) / 0.18))

  return {
    d,
    matrix,
    alpha
  }
}
