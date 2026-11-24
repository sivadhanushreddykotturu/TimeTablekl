/**
 * Profile pictures. Either one of Nuvio's sketch avatars (stored as its name),
 * or a custom picture (stored as "custom", with the image in `avatarCustom`:
 * a small data URL from the device, or an i.pinimg.com link from Pinterest).
 */
export const AVATARS = ["violet", "silas", "rowan", "nico", "moss"];

const BASE = "https://api.nuvio.tv/storage/v1/object/public/avatars/sketches";
const CUSTOM = "custom";

const readCustom = () => {
  try {
    return localStorage.getItem("avatarCustom") || "";
  } catch {
    return "";
  }
};

/** Any stored value maps to a valid avatar (older installs hold a random seed). */
function resolve(seed) {
  if (seed === CUSTOM && readCustom()) return CUSTOM;
  if (AVATARS.includes(seed)) return seed;
  let hash = 0;
  for (const ch of String(seed || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATARS[hash % AVATARS.length];
}

export function avatarUrl(seed) {
  const key = resolve(seed);
  return key === CUSTOM ? readCustom() : `${BASE}/${key}-v1.png`;
}

export function getAvatarSeed() {
  const stored = localStorage.getItem("avatarSeed");
  const seed = stored ? resolve(stored) : AVATARS[Math.floor(Math.random() * AVATARS.length)];
  if (seed !== stored) localStorage.setItem("avatarSeed", seed);
  return seed;
}

/** Stores a new avatar and tells the tab bar to show it. */
export function setAvatarSeed(seed) {
  localStorage.setItem("avatarSeed", seed);
  window.dispatchEvent(new CustomEvent("avatar_changed", { detail: seed }));
}

/** Uses `image` (data URL or Pinterest CDN link) as the picture. */
export function setCustomAvatar(image) {
  localStorage.setItem("avatarCustom", image);
  setAvatarSeed(CUSTOM);
}

/** Side of the saved square picture, in pixels. */
export const AVATAR_SIZE = 256;

/** A device photo, as a temporary link the cropper can open. Revoke it when done. */
export function deviceImageSource(file) {
  if (!file || !file.type.startsWith("image/")) throw new Error("Pick an image file.");
  return URL.createObjectURL(file);
}

/**
 * Resolves a Pinterest pin or profile link through our /api/pinterest function
 * and returns a same-origin link to its picture (via /api/pinimg), which the
 * cropper can draw on a canvas.
 */
export async function pinterestImageSource(link) {
  let data;
  try {
    const res = await fetch(`/api/pinterest?url=${encodeURIComponent(link.trim())}`);
    data = await res.json();
  } catch {
    throw new Error("Couldn't reach the server. Check your connection.");
  }
  if (!data?.success) throw new Error(data?.error || "Couldn't read that link.");
  return `/api/pinimg?src=${encodeURIComponent(data.image)}`;
}
