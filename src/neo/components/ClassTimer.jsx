import React, { useState, useEffect } from "react";

/**
 * ClassTimer — Isolated component for live class countdown & progress.
 *
 * Performance Note:
 * This component runs its own isolated 1s setInterval loop.
 * It reads Date.now() every tick (Timestamp Math — zero drift across app sleeps/minimize)
 * and only re-renders itself, keeping the rest of the page completely static.
 */
export default function ClassTimer({ startTimeMs, endTimeMs, mode = "both" }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!startTimeMs || !endTimeMs) return;

    // Immediately sync on mount
    setNowMs(Date.now());

    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [startTimeMs, endTimeMs]);

  if (!startTimeMs || !endTimeMs) return null;

  const totalMs = endTimeMs - startTimeMs;
  const elapsedMs = Math.max(0, nowMs - startTimeMs);
  const remainingMs = Math.max(0, endTimeMs - nowMs);
  const progressPercent = totalMs > 0 ? Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100)) : 100;

  const isWarning = remainingMs > 0 && remainingMs <= 5 * 60 * 1000; // <= 5 minutes
  const isFinished = remainingMs <= 0;

  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);
  const formattedTime = `${mins}:${secs.toString().padStart(2, "0")}`;

  if (mode === "readout") {
    return (
      <span className={`np-timer-readout${isWarning ? " np-timer-readout--warning" : ""}`}>
        {isFinished ? "ending..." : `${formattedTime} left`}
      </span>
    );
  }

  if (mode === "bar") {
    return (
      <div className="np-now__progress-track">
        <div
          className={`np-now__progress-bar${isWarning ? " np-now__progress-bar--warning" : ""}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    );
  }

  return (
    <>
      <span className={`np-timer-readout${isWarning ? " np-timer-readout--warning" : ""}`}>
        {isFinished ? "ending..." : `${formattedTime} left`}
      </span>
      <div className="np-now__progress-track">
        <div
          className={`np-now__progress-bar${isWarning ? " np-now__progress-bar--warning" : ""}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </>
  );
}

export function ClassTimerReadout({ startTimeMs, endTimeMs }) {
  return <ClassTimer startTimeMs={startTimeMs} endTimeMs={endTimeMs} mode="readout" />;
}

export function ClassProgressBar({ startTimeMs, endTimeMs }) {
  return <ClassTimer startTimeMs={startTimeMs} endTimeMs={endTimeMs} mode="bar" />;
}
