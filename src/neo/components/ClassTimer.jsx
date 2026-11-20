import React, { useState, useEffect } from "react";

/**
 * ClassTimer — live countdown & progress for the class in session.
 *
 * Runs its own 1s interval and reads Date.now() on every tick (timestamp math,
 * so no drift when the app sleeps), re-rendering only itself.
 */
export default function ClassTimer({ startTimeMs, endTimeMs, mode = "both" }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!startTimeMs || !endTimeMs) return;
    setNowMs(Date.now());
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startTimeMs, endTimeMs]);

  if (!startTimeMs || !endTimeMs) return null;

  const totalMs = endTimeMs - startTimeMs;
  const elapsedMs = Math.max(0, nowMs - startTimeMs);
  const remainingMs = Math.max(0, endTimeMs - nowMs);
  const progressPercent = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 100;

  const isWarning = remainingMs > 0 && remainingMs <= 5 * 60 * 1000;
  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);

  const readout = (
    <span className={`np-timer-readout${isWarning ? " np-timer-readout--warning" : ""}`}>
      {remainingMs <= 0 ? "Ending…" : `${mins}:${secs.toString().padStart(2, "0")} left`}
    </span>
  );

  const bar = (
    <div
      className="np-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progressPercent)}
    >
      <div
        className={`np-progress__fill${isWarning ? " np-progress__fill--warning" : ""}`}
        style={{ width: `${progressPercent}%` }}
      />
    </div>
  );

  if (mode === "readout") return readout;
  if (mode === "bar") return bar;
  return <>{readout}{bar}</>;
}

export function ClassTimerReadout({ startTimeMs, endTimeMs }) {
  return <ClassTimer startTimeMs={startTimeMs} endTimeMs={endTimeMs} mode="readout" />;
}

export function ClassProgressBar({ startTimeMs, endTimeMs }) {
  return <ClassTimer startTimeMs={startTimeMs} endTimeMs={endTimeMs} mode="bar" />;
}
