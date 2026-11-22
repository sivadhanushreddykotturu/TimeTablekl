/**
 * Profile pictures. Either one of Nuvio's sketch avatars (stored as its name),
 * or a custom picture (stored as "custom", with the image in `avatarCustom`:
 * a small data URL from the device, or an i.pinimg.com link from Pinterest).
 */
export const AVATARS = ["violet", "silas", "rowan", "nico", "moss"];

const BASE = "https://api.nuvio.tv/storage/v1/object/public/avatars/sketches";
const CUSTOM = "custom";
const SIZE = 256;

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

/** Centre-crops any image source to a small square JPEG data URL. */
function toSquareDataUrl(source) {
  return new Promise((resolveImage, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      if (!side) return reject(new Error("empty image"));
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        img,
        (img.naturalWidth - side) / 2,
        (img.naturalHeight - side) / 2,
        side,
        side,
        0,
        0,
        SIZE,
        SIZE
      );
      try {
        resolveImage(canvas.toDataURL("image/jpeg", 0.88));
      } catch (error) {
        reject(error); // canvas tainted (no CORS on the source)
      }
    };
    img.onerror = () => reject(new Error("image failed to load"));
    img.src = source;
  });
}

/** A file picked from the device becomes the avatar. */
export async function setAvatarFromFile(file) {
  if (!file || !file.type.startsWith("image/")) throw new Error("Pick an image file.");
  const url = URL.createObjectURL(file);
  try {
    setCustomAvatar(await toSquareDataUrl(url));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Resolves a Pinterest pin or profile link through our /api/pinterest function
 * and uses its picture. Saved as a small local copy when the CDN allows it,
 * otherwise the Pinterest image link itself.
 */
export async function setAvatarFromPinterest(link) {
  let data;
  try {
    const res = await fetch(`/api/pinterest?url=${encodeURIComponent(link.trim())}`);
    data = await res.json();
  } catch {
    throw new Error("Couldn't reach the server. Check your connection.");
  }
  if (!data?.success) throw new Error(data?.error || "Couldn't read that link.");
  try {
    setCustomAvatar(await toSquareDataUrl(data.image));
  } catch {
    setCustomAvatar(data.thumbnail || data.image);
  }
}
