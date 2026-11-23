import { useEffect, useState } from "react";
import { eventBackgroundEnabled, fetchEventTheme, preloadImage } from "../utils/eventTheme.js";

// One load per app session, shared by every visit to Today: it keeps running
// when the screen changes, and a later visit reuses the answer without asking again.
const session = { theme: null, tries: 0, finished: false, controller: null };
const listeners = new Set();
const MAX_TRIES = 3;

/** Why the app is not calm enough yet (null when it is). */
function notReady() {
  if (document.readyState !== "complete") return "loading";
  if (document.visibilityState !== "visible") return "hidden";
  if (!navigator.onLine) return "offline";
  const connection = navigator.connection;
  if (connection?.saveData) return "save-data";
  if (connection && /(^|-)2g$/.test(connection.effectiveType || "")) return "slow";
  return null;
}

async function startLoad() {
  if (session.controller || session.finished || session.tries >= MAX_TRIES) return;
  const controller = new AbortController();
  session.controller = controller;
  session.tries += 1;
  try {
    const found = await fetchEventTheme(controller.signal);
    if (controller.signal.aborted) return;
    if (!found) {
      session.finished = true; // no theme, or switched off: nothing more to do this session
      return;
    }
    await preloadImage(found.url, controller.signal);
    if (controller.signal.aborted) return;
    session.theme = found;
    session.finished = true;
    listeners.forEach((notify) => notify(found));
  } catch {
    // failed or interrupted: the normal gradient stays; a later calm moment may retry
  } finally {
    if (session.controller === controller) session.controller = null;
    // dropped for a sync: give the attempt back so the next calm moment can retry
    if (controller.signal.aborted && !session.finished) session.tries = Math.max(0, session.tries - 1);
  }
}

/**
 * The event background for the Today header, loaded only when the app is calm:
 * the page has finished loading, nothing is syncing, the tab is visible, the
 * device is online and not in data-saver. If a sync starts mid-load, the load is
 * dropped so the real request goes first, then tried again once things are calm.
 *
 * @param {boolean} busy true while the app is fetching its own data
 * @returns {{url, strength, accent, focus} | null}
 */
export function useEventBackground(busy) {
  const [theme, setTheme] = useState(session.theme);
  const [nudge, setNudge] = useState(0);

  // hear about a finished load, and wake up when the reasons to wait go away
  useEffect(() => {
    listeners.add(setTheme);
    const bump = () => setNudge((n) => n + 1);
    window.addEventListener("load", bump);
    window.addEventListener("online", bump);
    document.addEventListener("visibilitychange", bump);
    return () => {
      listeners.delete(setTheme);
      window.removeEventListener("load", bump);
      window.removeEventListener("online", bump);
      document.removeEventListener("visibilitychange", bump);
    };
  }, []);

  // the app's own requests always go first
  useEffect(() => {
    if (busy) session.controller?.abort();
  }, [busy]);

  useEffect(() => {
    if (session.theme) {
      setTheme(session.theme);
      return undefined;
    }
    if (session.finished || session.controller || busy) return undefined;
    if (!eventBackgroundEnabled() || notReady()) return undefined;

    // wait for an idle moment (or a short delay where the browser has no idle callback)
    let idleHandle;
    let timeoutHandle;
    if ("requestIdleCallback" in window) idleHandle = window.requestIdleCallback(startLoad, { timeout: 3000 });
    else timeoutHandle = setTimeout(startLoad, 1500);

    return () => {
      if (idleHandle) window.cancelIdleCallback(idleHandle);
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };
  }, [busy, nudge]);

  // the user's switch can turn it off without leaving the screen
  return eventBackgroundEnabled() ? theme : null;
}
