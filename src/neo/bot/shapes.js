// shapes.js — Body shape catalogue for the companion's random shape-shifting.
// Analytic radial profiles, all sampled at PROFILE_SAMPLES angles so any two
// shapes morph by a simple interpolation of radii.

import { PROFILE_SAMPLES, PROFILES } from './profiles.js'
import {
  hullOfCircles,
  profileFromPolygon,
  regularPolygonProfile,
  superellipseProfile,
  unionOfCirclesProfile
} from './shape.js'

/** Scale peak radius to `max` so all shapes have visually balanced visual weight. */
function normalize(radii, max = 1) {
  const peak = Math.max(...radii)
  if (peak <= 0) return radii
  const k = max / peak
  return radii.map((r) => r * k)
}

const ANGLES = Array.from({ length: PROFILE_SAMPLES }, (_, i) => (i / PROFILE_SAMPLES) * Math.PI * 2)

/** Pebble: organic irregular blob with smooth curves. */
const pebble = normalize(
  ANGLES.map((a) => 1 + 0.12 * Math.cos(2 * a + 0.5) + 0.06 * Math.cos(3 * a + 2.1)),
  1.04
)

/** Cloud: distinct round fluffy lobes. */
const cloud = normalize(
  unionOfCirclesProfile([
    { x: -0.48, y: 0.22, r: 0.58 },
    { x: 0.50, y: 0.22, r: 0.54 },
    { x: 0.02, y: 0.32, r: 0.65 },
    { x: -0.26, y: -0.32, r: 0.52 },
    { x: 0.32, y: -0.26, r: 0.48 }
  ]),
  1.04
)

/** Droplet: wide bottom disk, tapered pointed top. */
const droplet = normalize(
  profileFromPolygon(hullOfCircles(0, 0.28, 0.66, 0, -0.96, 0.05), 0, 0),
  1.05
)

export const SHAPES = [
  { id: 'circle', name: 'Circle', radii: new Array(PROFILE_SAMPLES).fill(1) },
  { id: 'squircle', name: 'Squircle', radii: normalize(superellipseProfile(4.2), 1.15) },
  { id: 'pebble', name: 'Pebble', radii: pebble },
  { id: 'cloud', name: 'Cloud', radii: cloud },
  { id: 'droplet', name: 'Droplet', radii: droplet },
  { id: 'hexagon', name: 'Hexagon', radii: regularPolygonProfile(6, 1.04, 0.26, 0) },
  { id: 'triangle', name: 'Triangle', radii: regularPolygonProfile(3, 1.12, 0.34, -90) },
  { id: 'egg', name: 'Egg', radii: PROFILES.egg }
]

export const DEFAULT_SHAPE_INDEX = 0
