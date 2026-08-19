// math.js — Pure math utilities ported from bloub (jeremy-prt/bloub)

export const TAU = Math.PI * 2

export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v)
export const lerp = (a, b, t) => a + (b - a) * t

/** Arrondi court : divise par ~2 le poids des chaines de path generees a 60 fps. */
export const r2 = (v) => Math.round(v * 100) / 100

/**
 * Mesure sur la video : les transitions sont des ease-out exponentiels, sans
 * depassement du corps. Les seuls effets de ressort sont locaux (le pop de la
 * pastille de notification, l'ouverture des yeux) et sont ecrits directement
 * dans l'etat concerne.
 */
export const easings = {
  easeOutCubic: (t) => 1 - (1 - t) ** 3,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  easeOutQuint: (t) => 1 - (1 - t) ** 5,
  easeOutElastic: (t) => {
    if (t === 0 || t === 1) return t
    const c4 = (2 * Math.PI) / 3
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
  }
}

/** Bruit 1D periodique : boucle sans couture sur `period`, utile pour la derive du regard. */
export function loopNoise(t, period, seed = 0) {
  const p = (t / period) * TAU
  return (
    0.55 * Math.sin(p + seed) +
    0.3 * Math.sin(2 * p + seed * 1.7 + 1.1) +
    0.15 * Math.sin(3 * p + seed * 2.3 + 2.4)
  )
}

/** PRNG deterministe (mulberry32) : meme sequence a chaque lecture. */
export function createRng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 1D periodic noise: seamless loop over `period`. */
export function noise1d(t, period = 1) {
  const x = ((t % period) / period) * TAU
  return (Math.sin(x) + Math.sin(x * 2.1 + 1.2) + Math.sin(x * 3.7 + 2.4)) / 3
}
