/**
 * Reads the live value of a CSS custom property, for canvas drawing
 * (which can't use CSS variables directly).
 *   getCSSColor("--np-acid") → "#f5f5f5"
 */
export function getCSSColor(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}
