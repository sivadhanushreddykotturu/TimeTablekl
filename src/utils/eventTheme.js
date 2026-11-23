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
