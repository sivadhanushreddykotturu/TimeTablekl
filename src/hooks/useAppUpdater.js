// src/hooks/useAppUpdater.js
import { useEffect } from "react";

/**
 * Background updates that never make the user wait.
 *
 * The service worker precaches every build. When a new one is deployed:
 *   1. we ask the worker to check (cheap: one small request for sw.js),
 *   2. it downloads the whole new build in the background while the current
 *      one keeps running from cache,
 *   3. once everything is stored it takes over, and we swap to it at a moment
 *      the user can't notice: when the app goes to the background, or on the
 *      next launch. That reload is served entirely from cache, so it's instant
 *      even on a bad connection.
 *
 * Nothing here deletes caches — doing that forced a full re-download on the
 * very connection that was already slow. Workbox removes outdated files itself
 * once the new build is safely in place.
 */

const CHECK_EVERY_MS = 15 * 60 * 1000;

export function useAppUpdater() {
  useEffect(() => {
    if (import.meta.env.DEV || !("serviceWorker" in navigator)) return;

    const sw = navigator.serviceWorker;
    // On a first visit the worker claims the page too; that's not an update.
    let hadController = Boolean(sw.controller);
    let updateReady = false;
    let reloading = false;
    let lastCheck = 0;

    const reloadOnce = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    const applyWhenUnseen = () => {
      if (updateReady && document.visibilityState === "hidden") reloadOnce();
    };

    const onControllerChange = () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      // The new build is fully cached and its worker is in control.
      updateReady = true;
      applyWhenUnseen();
    };

    const checkForUpdate = async () => {
      const now = Date.now();
      if (!navigator.onLine || now - lastCheck < CHECK_EVERY_MS) return;
      lastCheck = now;
      try {
        const registration = await sw.getRegistration();
        await registration?.update();
      } catch {
        // offline or flaky: try again later
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") applyWhenUnseen();
      else checkForUpdate();
    };

    // A page still running the old build may ask for a file the new deploy no
    // longer has. Reloading (from the fresh cache) fixes it; do it only once.
    const onPreloadError = (event) => {
      if (sessionStorage.getItem("chunk_reload")) return;
      sessionStorage.setItem("chunk_reload", "1");
      event.preventDefault();
      reloadOnce();
    };

    sw.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", applyWhenUnseen);
    window.addEventListener("vite:preloadError", onPreloadError);

    // Let the app start first; the check can wait for a quiet moment.
    const startTimer = setTimeout(checkForUpdate, 4000);
    const interval = setInterval(checkForUpdate, CHECK_EVERY_MS);

    return () => {
      sw.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", applyWhenUnseen);
      window.removeEventListener("vite:preloadError", onPreloadError);
      clearTimeout(startTimer);
      clearInterval(interval);
    };
  }, []);
}

export default useAppUpdater;
