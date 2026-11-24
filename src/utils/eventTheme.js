/**
 * "Event background": a subtle image behind the Today header, switched on and
 * off remotely by theme.json (same place as announcements.json: the
 * `announcements` branch, with a bundled public/theme.json as the fallback).
 *
 *   {
 *     "active": true,
 *     "image": "doomsday.jpg",          // file next to theme.json, or a full https link (tablets and laptops)
 *     "imageMobile": "doomsday-m.jpg",  // optional smaller picture for phones; phones use "image" if missing
 *     "version": "1",                   // change it when you swap the image (busts caches)
 *     "strength": 0.5,                  // 0.1 to 0.9, how visible
 *     "accent": "#2f8fa0",              // optional tint for the header glow
 *     "focus": "50% 25%",               // which part of the image stays in view
 *     "glow": false,                    // true keeps the coloured glow behind the image
 *     "devices": ["mobile", "tablet", "desktop"],  // where it shows; others never download it
 *     "expires": "2026-12-31"           // optional, switches itself off after this day
 *   }
 */
import { BRANCH_BASE } from "./announcement.js";

const PREF_KEY = "event_bg";
const HEX = /^#[0-9a-f]{3,8}$/i;
const FOCUS = /^\d{1,3}%\s+\d{1,3}%$/;
const DEVICES = ["mobile", "tablet", "desktop"];

/** mobile under 768 px, tablet under 1024 px, otherwise desktop (laptop). */
function deviceClass() {
  const width = window.innerWidth;
  return width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop";
}

/** The user's own switch (Profile). On unless they turned it off. */
export function eventBackgroundEnabled() {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setEventBackgroundEnabled(on) {
  try {
    if (on) localStorage.removeItem(PREF_KEY);
    else localStorage.setItem(PREF_KEY, "off");
  } catch {
    /* storage unavailable */
  }
}

async function getJson(url, ms, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Checks the file and turns it into safe values, or null when the theme is off. */
function clean(raw, base) {
  if (!raw || raw.active !== true || typeof raw.image !== "string" || !raw.image.trim()) return null;

  if (raw.expires) {
    const end = new Date(`${raw.expires}T23:59:59`);
    if (!Number.isNaN(end.getTime()) && Date.now() > end.getTime()) return null;
  }

  // not for this kind of device: stop here, so the image is never downloaded
  const devices = Array.isArray(raw.devices) ? raw.devices.filter((d) => DEVICES.includes(d)) : DEVICES;
  if (!devices.includes(deviceClass())) return null;

  // phones get the smaller picture when there is one, so they download less
  const chosen =
    deviceClass() === "mobile" && typeof raw.imageMobile === "string" && raw.imageMobile.trim()
      ? raw.imageMobile
      : raw.image;

  let url;
  try {
    url = new URL(chosen.trim(), base);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.origin !== window.location.origin) return null;
  if (raw.version) url.searchParams.set("v", String(raw.version).slice(0, 32));

  const strength = Number(raw.strength);
  return {
    url: url.href,
    expires: typeof raw.expires === "string" ? raw.expires : "",
    strength: Math.min(0.9, Math.max(0.1, Number.isFinite(strength) ? strength : 0.5)),
    accent: typeof raw.accent === "string" && HEX.test(raw.accent) ? raw.accent : "",
    glow: raw.glow === true,
    focus: typeof raw.focus === "string" && FOCUS.test(raw.focus.trim()) ? raw.focus.trim() : "50% 25%",
  };
}

/**
 * The active event theme, or null. Looks on the branch first, then at the copy
 * shipped with the app. A file that is found but switched off counts as "no theme".
 */
export async function fetchEventTheme(signal) {
  for (const base of [BRANCH_BASE, `${window.location.origin}/`]) {
    const data = await getJson(`${base}theme.json`, 4000, signal);
    if (data) return clean(data, base);
  }
  return null;
}

/** Downloads and decodes the image off-screen so it can fade in without a jump. */
export function preloadImage(url, signal, ms = 10000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    if ("fetchPriority" in img) img.fetchPriority = "low";
    const timer = setTimeout(() => finish(new Error("timeout")), ms);
    const finish = (error) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (error) {
        img.src = "";
        reject(error);
      } else {
        resolve();
      }
    };
    const onAbort = () => finish(new Error("aborted"));
    signal?.addEventListener("abort", onAbort);
    img.onload = () => (img.decode ? img.decode().catch(() => {}).then(() => finish()) : finish());
    img.onerror = () => finish(new Error("failed"));
    img.src = url;
  });
}

/* ------------------------------------------------------------------
   Remembering the picture on this device, so a repeat visit shows it at
   once instead of waiting for the network. The picture itself lives in the
   Cache API (no size worry), its settings in localStorage.
   ------------------------------------------------------------------ */

const CACHE_NAME = "event-bg-v1";
const META_KEY = "event_bg_cache";
const IMG_KEY = "event_bg_img"; // the picture itself as a small data link, readable before the screen draws
const MAX_INLINE = 400 * 1024; // bigger pictures stay in the Cache API only (still fast, but one step later)

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(",");
  const mime = (/^data:([^;]+);base64/.exec(dataUrl.slice(0, comma)) || [])[1] || "image/jpeg";
  const bytes = atob(dataUrl.slice(comma + 1));
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) array[i] = bytes.charCodeAt(i);
  return new Blob([array], { type: mime });
}

const isExpired = (expires) => {
  if (!expires) return false;
  const end = new Date(`${expires}T23:59:59`);
  return !Number.isNaN(end.getTime()) && Date.now() > end.getTime();
};

/** Waits for a picture link to be drawn, so it can fade in without a jump. */
function decodeImage(src) {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
}

/**
 * Downloads the picture, keeps a copy on this device and returns a link that
 * shows instantly next time. If the host does not allow that kind of download,
 * it falls back to the plain link (shown, but not kept).
 */
export async function loadImage(url, signal, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`image ${res.status}`);
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) throw new Error("not an image");
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(url, new Response(blob, { headers: { "Content-Type": blob.type } }));
      for (const request of await cache.keys()) if (request.url !== url) await cache.delete(request); // keep only this one
    } catch {
      /* no Cache API (private window?): it still shows, it just is not kept */
    }
    // a small copy that can be read instantly at the next launch
    try {
      if (blob.size <= MAX_INLINE) localStorage.setItem(IMG_KEY, await blobToDataUrl(blob));
      else localStorage.removeItem(IMG_KEY);
    } catch {
      /* storage full: the Cache API copy still works */
    }
    const objectUrl = URL.createObjectURL(blob);
    await decodeImage(objectUrl);
    return objectUrl;
  } catch (error) {
    if (signal?.aborted) throw error;
    await preloadImage(url, signal, ms); // plain link as a fallback
    return url;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Remembers the theme (its settings) so the next launch can show it before any network call. */
export function rememberTheme(theme) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify({ ...theme, device: deviceClass() }));
  } catch {
    /* storage unavailable */
  }
}

/** The remembered theme if it can still be shown on this device (same device class, not ended). */
function rememberedMeta() {
  let meta = null;
  try {
    meta = JSON.parse(localStorage.getItem(META_KEY) || "null");
  } catch {
    /* ignore */
  }
  if (!meta?.url || meta.device !== deviceClass() || isExpired(meta.expires)) return null;
  return meta;
}

/**
 * The remembered theme and picture, read synchronously (before the screen draws), or null
 * when the picture was too big to keep inline. Never touches the network.
 */
export function readRememberedThemeNow() {
  const meta = rememberedMeta();
  if (!meta) return null;
  try {
    const data = localStorage.getItem(IMG_KEY);
    if (!data || !data.startsWith("data:image/")) return null;
    return { theme: meta, objectUrl: URL.createObjectURL(dataUrlToBlob(data)) };
  } catch {
    return null;
  }
}

/** The remembered theme with a ready-to-show picture link, or null. Never touches the network. */
export async function readRememberedTheme() {
  const meta = rememberedMeta();
  if (!meta) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(meta.url);
    if (!hit) return null;
    const objectUrl = URL.createObjectURL(await hit.blob());
    return { theme: meta, objectUrl };
  } catch {
    return null;
  }
}

/** Forgets the remembered theme and picture (it was switched off, or has ended). */
export async function forgetTheme() {
  try {
    localStorage.removeItem(META_KEY);
    localStorage.removeItem(IMG_KEY);
  } catch {
    /* ignore */
  }
  try {
    await caches.delete(CACHE_NAME);
  } catch {
    /* ignore */
  }
}
