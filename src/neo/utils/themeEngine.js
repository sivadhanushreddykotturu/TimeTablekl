/* ================================================================
   themeEngine.js — neoPOP Theme Engine
   Presets · Custom themes · CSS-variable application · localStorage
   ================================================================ */

// ── Color Utilities ──────────────────────────────────────────────

/** Parse "#rrggbb" → { r, g, b } */
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

/** { r, g, b } → "#rrggbb" */
function rgbToHex({ r, g, b }) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    "#" +
    [r, g, b]
      .map((c) => clamp(c).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Get relative luminance of a color to determine if text should be light or dark */
export function getLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Return dark or light text color based on background hex */
export function getContrastColor(hex) {
  return getLuminance(hex) > 0.55 ? "#0a0a0c" : "#f4f2ea";
}

/**
 * Darken a hex color by a factor (0–1).
 * darken("#cfff04", 0.35) → ~35% darker
 */
export function darken(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({
    r: r * (1 - amount),
    g: g * (1 - amount),
    b: b * (1 - amount),
  });
}

/**
 * Lighten a hex color by a factor (0–1).
 * lighten("#cfff04", 0.2) → ~20% lighter
 */
export function lighten(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({
    r: r + (255 - r) * amount,
    g: g + (255 - g) * amount,
    b: b + (255 - b) * amount,
  });
}

// ── Theme Builder ────────────────────────────────────────────────

/**
 * Build a complete theme object from just 3 user-chosen colors.
 * Mid/deep extrusion shades are auto-generated.
 */
export function buildTheme(id, name, accent, secondary, danger) {
  return {
    id,
    name,
    accent,
    accentMid: darken(accent, 0.35),
    accentDeep: darken(accent, 0.55),
    accentHover: lighten(accent, 0.15),
    accentText: getContrastColor(accent),
    secondary,
    secondaryDeep: darken(secondary, 0.35),
    secondaryText: getContrastColor(secondary),
    danger,
    dangerMid: darken(danger, 0.35),
    dangerDeep: darken(danger, 0.55),
    dangerHover: lighten(danger, 0.2),
    dangerText: getContrastColor(danger),
  };
}

// ── Built-in Presets (List A — immutable) ─────────────────────────

export const PRESETS = [
  buildTheme("neopop",   "neoPOP",    "#cfff04", "#6533f4", "#ff2e63"),
  buildTheme("midnight", "Midnight",  "#00e5ff", "#6366f1", "#ff0055"),
  buildTheme("ember",    "Ember",     "#ff8800", "#d97706", "#ff3333"),
  buildTheme("sakura",   "Sakura",    "#ff00a2", "#7b00ff", "#ff5500"),
  buildTheme("mint",     "Mint",      "#00ff88", "#06b6d4", "#ff0066"),
];

export const DEFAULT_THEME = PRESETS[0];

// ── Font Presets ──────────────────────────────────────────────────

export const FONT_PRESETS = [
  {
    id: "neopop",
    name: "neoPOP",
    vibe: "Default Vibe",
    ui: "'Space Grotesk', 'Segoe UI', sans-serif",
    display: "'Archivo Black', 'Arial Black', sans-serif",
  },
  {
    id: "comic",
    name: "Comic Neue",
    vibe: "Meme Vibe",
    ui: "'Comic Neue', cursive, sans-serif",
    display: "'Comic Neue', cursive, sans-serif",
  },
  {
    id: "arcade",
    name: "Silkscreen",
    vibe: "Retro Arcade 8-Bit",
    ui: "'Silkscreen', monospace",
    display: "'Silkscreen', monospace",
  },
  {
    id: "vt323",
    name: "VT323",
    vibe: "Retro Terminal",
    ui: "'VT323', monospace",
    display: "'VT323', monospace",
  },
];

export const DEFAULT_FONT = FONT_PRESETS[0];

// ── Font Size Presets ─────────────────────────────────────────────

export const FONT_SIZE_PRESETS = [
  { id: "small", name: "small (92%)", scale: "0.92" },
  { id: "default", name: "default (100%)", scale: "1" },
  { id: "large", name: "large (110%)", scale: "1.1" },
];

export const DEFAULT_FONT_SIZE = FONT_SIZE_PRESETS[1];

// ── localStorage Keys ────────────────────────────────────────────

const LS_ACTIVE  = "np_active_theme";   // stores the ID string of the active theme
const LS_CUSTOM  = "np_custom_themes";  // stores JSON array of user-created theme objects
const LS_FONT    = "np_active_font";    // stores the ID string of the active font
const LS_FONT_SIZE = "np_active_font_size"; // stores ID string of active font size

// ── Apply Theme (set CSS variables on :root) ─────────────────────

/**
 * Apply a theme object to the document by setting CSS custom
 * properties on <html>. This instantly re-themes the entire app.
 */
export function applyTheme(theme) {
  if (!theme) return;
  const s = document.documentElement.style;

  // Primary accent
  s.setProperty("--np-acid",      theme.accent);
  s.setProperty("--np-acid-mid",  theme.accentMid);
  s.setProperty("--np-acid-deep", theme.accentDeep);
  s.setProperty("--np-acid-text", theme.accentText);

  // Secondary accent
  s.setProperty("--np-purple",      theme.secondary);
  s.setProperty("--np-purple-deep", theme.secondaryDeep);
  s.setProperty("--np-purple-text", theme.secondaryText);

  // Danger / pink
  s.setProperty("--np-pink",      theme.danger);
  s.setProperty("--np-pink-mid",  theme.dangerMid);
  s.setProperty("--np-pink-deep", theme.dangerDeep);
  s.setProperty("--np-pink-text", theme.dangerText);
}

// ── Apply Font ───────────────────────────────────────────────────

/** Apply font custom properties to documentElement */
export function applyFont(font) {
  if (!font) return;
  const s = document.documentElement.style;
  s.setProperty("--np-font-ui", font.ui);
  s.setProperty("--np-font-display", font.display);
}

export function saveActiveFontId(id) {
  try { localStorage.setItem(LS_FONT, id); } catch { /* quota */ }
}

export function getActiveFontId() {
  try { return localStorage.getItem(LS_FONT); } catch { return null; }
}

export function resolveFontById(id) {
  if (!id) return DEFAULT_FONT;
  return FONT_PRESETS.find((f) => f.id === id) || DEFAULT_FONT;
}

// ── Apply Font Size ──────────────────────────────────────────────

export function applyFontSize(scale) {
  if (!scale) return;
  document.documentElement.style.setProperty("--np-font-scale", scale);
}

export function saveActiveFontSizeId(id) {
  try { localStorage.setItem(LS_FONT_SIZE, id); } catch { /* quota */ }
}

export function getActiveFontSizeId() {
  try { return localStorage.getItem(LS_FONT_SIZE); } catch { return null; }
}

export function resolveFontSizeById(id) {
  if (!id) return DEFAULT_FONT_SIZE;
  return FONT_SIZE_PRESETS.find((s) => s.id === id) || DEFAULT_FONT_SIZE;
}

// ── Persistence ──────────────────────────────────────────────────

/** Save the active theme's ID to localStorage */
export function saveActiveThemeId(id) {
  try { localStorage.setItem(LS_ACTIVE, id); } catch { /* quota */ }
}

/** Get the saved active theme ID (or null) */
export function getActiveThemeId() {
  try { return localStorage.getItem(LS_ACTIVE); } catch { return null; }
}

/** Get all user-created custom themes from localStorage */
export function getUserThemes() {
  try {
    const raw = localStorage.getItem(LS_CUSTOM);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Save the full array of user-created themes to localStorage */
export function saveUserThemes(themes) {
  try { localStorage.setItem(LS_CUSTOM, JSON.stringify(themes)); } catch { /* quota */ }
}

/** Delete a custom theme by id */
export function deleteUserTheme(id) {
  const themes = getUserThemes().filter((t) => t.id !== id);
  saveUserThemes(themes);
  return themes;
}

// ── Resolve a theme by ID (checks presets first, then custom) ────

export function resolveThemeById(id) {
  if (!id) return null;
  const preset = PRESETS.find((p) => p.id === id);
  if (preset) return preset;
  const custom = getUserThemes().find((t) => t.id === id);
  return custom || null;
}

// ── Load & Apply on App Start ────────────────────────────────────

/**
 * Called once on app mount. Reads the saved theme ID from
 * localStorage, resolves it, and applies it. Falls back to default.
 */
export function loadAndApplyTheme() {
  const id = getActiveThemeId();
  if (id && id !== DEFAULT_THEME.id) {
    const theme = resolveThemeById(id);
    if (theme) applyTheme(theme);
  }

  const fontId = getActiveFontId();
  if (fontId) {
    const font = resolveFontById(fontId);
    if (font) applyFont(font);
  }

  const fontSizeId = getActiveFontSizeId();
  if (fontSizeId) {
    const fontSize = resolveFontSizeById(fontSizeId);
    if (fontSize) applyFontSize(fontSize.scale);
  }
}

// ── Read current CSS variable values (for canvas drawing) ────────

/**
 * Read the live computed value of a CSS custom property.
 * Useful for canvas 2D drawing that can't use CSS vars directly.
 *
 * Usage: getCSSColor("--np-acid") → "#cfff04" (or whatever the theme set)
 */
export function getCSSColor(varName) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
}
