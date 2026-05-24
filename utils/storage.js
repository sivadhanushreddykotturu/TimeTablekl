// utils/storage.js
// ─────────────────────────────────────────────────────────────────────────────
// Canonical localStorage key for session cookies
const COOKIE_KEY = "erp_session_cookies";

// ─── Credential Storage ───────────────────────────────────────────────────────
export const saveCredentials = (creds) => {
  localStorage.setItem("erp_creds", JSON.stringify(creds));
};

export const getCredentials = () => {
  try {
    const raw = localStorage.getItem("erp_creds");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearCredentials = () => {
  localStorage.removeItem("erp_creds");
};

// ─── Cookie / Session Storage ─────────────────────────────────────────────────
// Canonical shape: { PHPSESSID, _csrf_token, _csrf, kl_erp_device_id, SERVERID }
// Backend v7.5 always returns both _csrf_token and _csrf on every route.

/**
 * Normalises a cookies block so _csrf and _csrf_token are always both present.
 * The backend now sends both, but older cached values may only have one.
 */
export const normaliseCookies = (cookies) => {
  if (!cookies || typeof cookies !== "object") return {};
  const n = { ...cookies };
  if (n._csrf && !n._csrf_token) n._csrf_token = n._csrf;
  if (n._csrf_token && !n._csrf) n._csrf = n._csrf_token;
  return n;
};

/**
 * Persists cookies to localStorage after normalising.
 * Silently skips null / empty payloads.
 */
export const saveCookies = (cookies) => {
  if (!cookies || typeof cookies !== "object") return;
  if (Object.keys(cookies).length === 0) return;
  localStorage.setItem(COOKIE_KEY, JSON.stringify(normaliseCookies(cookies)));
};

/**
 * Retrieves the stored session cookies (canonical shape), or null.
 */
export const getStoredCookies = () => {
  try {
    const raw = localStorage.getItem(COOKIE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// Backward-compat alias used by api.js and other callers
export const getCookies = getStoredCookies;

export const clearCookies = () => {
  localStorage.removeItem(COOKIE_KEY);
};

/**
 * Universal API response interceptor.
 *
 * The backend (v7.5) ALWAYS returns a non-empty cookies block on every route,
 * regardless of the session_refreshed flag. We save whenever cookies are present.
 *
 * Usage: handleSessionRefresh(res.data);
 */
export const handleSessionRefresh = (responseData) => {
  if (!responseData) return;
  const cookies = responseData.cookies;
  if (!cookies || typeof cookies !== "object") return;
  if (Object.keys(cookies).length === 0) return;
  // Always save — backend guarantees fresh tokens in every response
  saveCookies(cookies);
};
