import { useEffect, useState } from "react";
import {
  eventBackgroundEnabled,
  fetchEventTheme,
  forgetTheme,
  loadImage,
  readRememberedTheme,
  rememberTheme,
} from "../utils/eventTheme.js";

// One shared state for the whole app session, so every visit to Today sees the same thing.
//  - theme: what is on screen (a remembered copy at launch, then the live one)
//  - finished: the live theme.json has been checked this session
const session = { theme: null, tries: 0, finished: false, controller: null, restored: false };
const listeners = new Set();
const MAX_TRIES = 3;
const FAST_FADE = 450; // a picture that was already on this device just appears
const SLOW_FADE = 1600; // a picture seen for the first time eases in

function publish(theme) {
  session.theme = theme;
  listeners.forEach((notify) => notify(theme));
}

/** Why the app is not calm enough to go to the network yet (null when it is). */
function notReady() {
  if (document.readyState !== "complete") return "loading";
  if (document.visibilityState !== "visible") return "hidden";
  if (!navigator.onLine) return "offline";
  const connection = navigator.connection;
  if (connection?.saveData) return "save-data";
  if (connection && /(^|-)2g$/.test(connection.effectiveType || "")) return "slow";
  return null;
}

/** Shows the picture remembered on this device straight away; costs no network at all. */
async function restoreRemembered() {
  if (session.restored) return;
  session.restored = true;
  const remembered = await readRememberedTheme();
  if (remembered && !session.theme) {
    publish({ ...remembered.theme, remote: remembered.theme.url, url: remembered.objectUrl, fade: FAST_FADE });
  }
}

/** Asks for the live theme and updates what is on screen (and what is remembered). */
async function refreshLive() {
  if (session.controller || session.finished || session.tries >= MAX_TRIES) return;
  const controller = new AbortController();
  session.controller = controller;
  session.tries += 1;
  try {
    const found = await fetchEventTheme(controller.signal);
    if (controller.signal.aborted) return;

    if (!found) {
      // switched off, ended, or not for this device
      session.finished = true;
      if (session.theme) {
        publish(null);
        await forgetTheme();
      }
      return;
    }

    const shown = session.theme;
    if (shown && shown.remote === found.url) {
      // the same picture is already on screen: only the settings may have changed, nothing to download
      rememberTheme(found);
      publish({ ...shown, ...found, remote: found.url, url: shown.url, fade: shown.fade });
      session.finished = true;
      return;
    }

    const link = await loadImage(found.url, controller.signal);
    if (controller.signal.aborted) return;
    rememberTheme(found);
    publish({ ...found, remote: found.url, url: link, fade: shown ? FAST_FADE : SLOW_FADE });
    session.finished = true;
  } catch {
    // failed or interrupted: what is on screen stays; a later calm moment may retry
  } finally {
    if (session.controller === controller) session.controller = null;
    // dropped for a sync: give the attempt back so the next calm moment can retry
    if (controller.signal.aborted && !session.finished) session.tries = Math.max(0, session.tries - 1);
  }
}

/**
 * The event background for the Today header.
 *  - A picture seen before is shown at once from this device (no network).
 *  - The live theme.json is checked only when the app is calm: the page has finished
 *    loading, nothing is syncing, the tab is visible, the device is online and not in
 *    data-saver. A sync that starts mid-check drops it so the real request goes first.
 *  - The picture is downloaded again only when it actually changed.
 *
 * @param {boolean} busy true while the app is fetching its own data
 * @returns {{url, strength, accent, focus, glow, fade} | null}
 */
export function useEventBackground(busy) {
  const [theme, setTheme] = useState(session.theme);
  const [nudge, setNudge] = useState(0);

  // hear about changes, show the remembered picture, and wake up when the reasons to wait go away
  useEffect(() => {
    listeners.add(setTheme);
    if (eventBackgroundEnabled()) restoreRemembered();
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
    setTheme(session.theme);
    if (session.finished || session.controller || busy) return undefined;
    if (!eventBackgroundEnabled() || notReady()) return undefined;

    // wait for an idle moment (or a short delay where the browser has no idle callback)
    let idleHandle;
    let timeoutHandle;
    if ("requestIdleCallback" in window) idleHandle = window.requestIdleCallback(refreshLive, { timeout: 3000 });
    else timeoutHandle = setTimeout(refreshLive, 1500);

    return () => {
      if (idleHandle) window.cancelIdleCallback(idleHandle);
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };
  }, [busy, nudge]);

  // the user's switch can turn it off without leaving the screen
  return eventBackgroundEnabled() ? theme : null;
}
