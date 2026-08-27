// src/hooks/useAppUpdater.js
import { useEffect, useRef } from "react";

// Injected by Vite define at build time
const CURRENT_BUILD_ID = typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "dev";

export function useAppUpdater() {
  const isCheckingRef = useRef(false);
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    // 1. Silent Check & Update Logic
    const checkForAppUpdate = async () => {
      if (isCheckingRef.current || isUpdatingRef.current) return;
      if (process.env.NODE_ENV === "development" && CURRENT_BUILD_ID === "dev") return;

      try {
        isCheckingRef.current = true;

        // Force network-only fetch with timestamp to bypass iOS/Android disk cache
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "Pragma": "no-cache",
            "Cache-Control": "no-cache, no-store, must-revalidate"
          }
        });

        if (!res.ok) return;
        const serverVersion = await res.json();

        // If server buildId differs from running buildId
        if (serverVersion && serverVersion.buildId && serverVersion.buildId !== CURRENT_BUILD_ID) {
          console.log(`[PWA Update] New version detected (Server: ${serverVersion.buildId} vs App: ${CURRENT_BUILD_ID})`);
          isUpdatingRef.current = true;

          // Request Service Worker to update
          if ("serviceWorker" in navigator) {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
              await registration.update();
            }
          }

          // Clean up old CacheStorage code buckets (leaves localStorage intact)
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }

          // Clean reload to new code
          window.location.reload();
        } else {
          // If version matches, still trigger background SW update check
          if ("serviceWorker" in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) reg.update();
          }
        }
      } catch (err) {
        // Network offline or failed - ignore silently
      } finally {
        isCheckingRef.current = false;
      }
    };

    // 2. Cold Start Check
    checkForAppUpdate();

    // 3. Resume / App Switcher / Visibility Listeners (Crucial for iOS & Android)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkForAppUpdate();
      }
    };

    const handlePageShow = (e) => {
      // iOS Safari fires pageshow when restored from frozen state (e.persisted)
      if (e.persisted || document.visibilityState === "visible") {
        checkForAppUpdate();
      }
    };

    const handleFocus = () => {
      checkForAppUpdate();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handleFocus);

    // 4. Periodic background polling every 10 minutes for long-running sessions
    const interval = setInterval(checkForAppUpdate, 10 * 60 * 1000);

    // 5. Handle Service Worker controller change (skipWaiting activation)
    let refreshing = false;
    const handleControllerChange = () => {
      if (!refreshing && isUpdatingRef.current) {
        refreshing = true;
        window.location.reload();
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      }
    };
  }, []);
}

export default useAppUpdater;
