import { useEffect, useState } from "react";

// Changes every 30s and whenever the app returns to the foreground, so time-based
// derivations (current/next class) don't go stale on a page left open or a resumed PWA.
export function useNowTick(intervalMs = 30000) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const id = setInterval(bump, intervalMs);
    document.addEventListener("visibilitychange", bump);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", bump);
    };
  }, [intervalMs]);

  return tick;
}
