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

/** { r, g, b } → { h: 0-360, s: 0-1, l: 0-1 } */
function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

/** { h: 0-360, s: 0-1, l: 0-1 } → "#rrggbb" */
function hslToHex({ h, s, l }) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
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

// ── Curated Swatches (all vetted for contrast on the dark UI) ─────

export const ACCENT_SWATCHES = [
  "#cfff04", "#00e5ff", "#00ff88", "#ffd600",
  "#ff8800", "#ff00a2", "#b388ff", "#7cff6b",
  "#4dfff3", "#ff5c8a", "#f4f2ea", "#a3ff12",
];

export const SECONDARY_SWATCHES = [
  "#6533f4", "#6366f1", "#06b6d4", "#d97706",
  "#7b00ff", "#3b82f6", "#ec4899", "#10b981",
  "#f97316", "#14b8a6", "#8b5cf6", "#e11d48",
];

export const DANGER_SWATCHES = [
  "#ff2e63", "#ff0055", "#ff3333", "#ff5500",
  "#ff0066", "#ff3d00", "#f43f5e", "#ff1744",
];

/**
 * Suggest a harmonious (secondary, danger) pair for a given accent.
 * Secondary = complementary hue; danger = warm crimson family
 * (shifted to orange if the accent itself is already crimson).
 */
export function suggestHarmony(accent) {
  const { h, s } = rgbToHsl(hexToRgb(accent));
  const secondary = hslToHex({ h: h + 180, s: Math.max(0.55, s * 0.9), l: 0.58 });
  const dangerHue = Math.abs(h - 345) < 40 ? 22 : 345;
  const danger = hslToHex({ h: dangerHue, s: 0.9, l: 0.56 });
  return { secondary, danger };
}

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

/** Scoped CSS-var style object for painting mini previews with a theme. */
export function themeVars(theme) {
  return {
    "--np-acid": theme.accent,
    "--np-acid-deep": theme.accentDeep,
    "--np-acid-text": theme.accentText,
    "--np-purple": theme.secondary,
    "--np-purple-text": theme.secondaryText,
    "--np-pink": theme.danger,
    "--np-pink-text": theme.dangerText,
  };
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

// ── Shareable Theme Codes ────────────────────────────────────────
//
// Format: TTK1-<accent hex><secondary hex><danger hex><font idx><size idx><checksum>
// Example: TTK1-CFFF046533F4FF2E6311X
// Fully offline — the whole look (colors + font + size) fits in ~26 chars.

const CODE_PREFIX = "TTK1-";
const B36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function codeChecksum(payload) {
  let sum = 0;
  for (const ch of payload) sum = (sum + ch.charCodeAt(0)) % 36;
  return B36[sum];
}

/** Encode a theme + font + font size into a shareable code string. */
export function encodeThemeCode(theme, fontId, fontSizeId) {
  const hex = (c) => c.replace("#", "").toUpperCase();
  const fi = Math.max(0, FONT_PRESETS.findIndex((f) => f.id === fontId));
  const zi = Math.max(0, FONT_SIZE_PRESETS.findIndex((s) => s.id === fontSizeId));
  const payload =
    hex(theme.accent) +
    hex(theme.secondary) +
    hex(theme.danger) +
    fi.toString(36).toUpperCase() +
    zi.toString(36).toUpperCase();
  return CODE_PREFIX + payload + codeChecksum(payload);
}

/**
 * Decode a share code. Returns { accent, secondary, danger, fontId, fontSizeId }
 * or null if the code is malformed or fails its checksum.
 */
export function decodeThemeCode(input) {
  if (!input) return null;
  const code = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!code.startsWith(CODE_PREFIX)) return null;
  const body = code.slice(CODE_PREFIX.length);
  if (!/^[0-9A-F]{18}[0-9A-Z]{3}$/.test(body)) return null;
  const payload = body.slice(0, 20);
  if (codeChecksum(payload) !== body[20]) return null;
  const fi = parseInt(body[18], 36);
  const zi = parseInt(body[19], 36);
  if (fi >= FONT_PRESETS.length || zi >= FONT_SIZE_PRESETS.length) return null;
  return {
    accent: "#" + body.slice(0, 6),
    secondary: "#" + body.slice(6, 12),
    danger: "#" + body.slice(12, 18),
    fontId: FONT_PRESETS[fi].id,
    fontSizeId: FONT_SIZE_PRESETS[zi].id,
  };
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
