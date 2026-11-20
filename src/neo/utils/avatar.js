/** Profile pictures: Nuvio's sketch avatars, served from Nuvio's storage. */
export const AVATARS = ["violet", "silas", "rowan", "nico", "moss"];

const BASE = "https://api.nuvio.tv/storage/v1/object/public/avatars/sketches";

/** Any stored value maps to one of the avatars (older installs hold a random seed). */
function resolve(seed) {
  if (AVATARS.includes(seed)) return seed;
  let hash = 0;
  for (const ch of String(seed || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATARS[hash % AVATARS.length];
}

export function avatarUrl(seed) {
  return `${BASE}/${resolve(seed)}-v1.png`;
}

export function getAvatarSeed() {
  const stored = localStorage.getItem("avatarSeed");
  const seed = stored ? resolve(stored) : AVATARS[Math.floor(Math.random() * AVATARS.length)];
  if (seed !== stored) localStorage.setItem("avatarSeed", seed);
  return seed;
}

/** The avatar after this one (wraps around). */
export function nextAvatar(seed) {
  return AVATARS[(AVATARS.indexOf(resolve(seed)) + 1) % AVATARS.length];
}

/** Stores a new avatar and tells the tab bar to show it. */
export function setAvatarSeed(seed) {
  localStorage.setItem("avatarSeed", seed);
  window.dispatchEvent(new CustomEvent("avatar_changed", { detail: seed }));
}
