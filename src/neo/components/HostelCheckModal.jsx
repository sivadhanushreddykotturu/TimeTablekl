import React, { useCallback, useEffect, useRef, useState } from "react";
import { NeoModal, NeoLoading } from "../Shell.jsx";
import { checkHostel } from "../../utils/hostel.js";

const COUNTDOWN = 3;

/**
 * The one-time hostel check behind the Outpass tap.
 *   hostler        -> onHostler()
 *   not a hostler  -> says so, counts 3·2·1, closes (the entry is then hidden for good)
 *   check failed   -> nothing is saved; offers a retry
 */
export default function HostelCheckModal({ open, onClose, onHostler }) {
  const [phase, setPhase] = useState("checking");
  const [count, setCount] = useState(COUNTDOWN);
  const run = useRef(0);
  // The parent passes inline callbacks; keep them out of the effects' dependencies so a re-render never re-runs the check.
  const handlers = useRef({ onClose, onHostler });
  handlers.current = { onClose, onHostler };

  const check = useCallback(async () => {
    const id = ++run.current;
    setPhase("checking");
    setCount(COUNTDOWN);
    const result = await checkHostel();
    if (id !== run.current) return; // closed or retried meanwhile
    if (result === "yes") handlers.current.onHostler();
    else setPhase(result === "no" ? "no" : "error");
  }, []);

  useEffect(() => {
    if (open) check();
    return () => {
      run.current += 1;
    };
  }, [open, check]);

  useEffect(() => {
    if (!open || phase !== "no") return;
    if (count <= 0) {
      handlers.current.onClose();
      return;
    }
    const timer = setTimeout(() => setCount((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, phase, count]);

  return (
    <NeoModal open={open} title="Outpass" onClose={onClose}>
      {phase === "checking" && <NeoLoading text="Checking your hostel status…" />}

      {phase === "no" && (
        <p className="np-note" role="status">
          You're not a hostler, so outpass isn't available for you. Closing in {Math.max(count, 1)}…
        </p>
      )}

      {phase === "error" && (
        <>
          <p className="np-note" style={{ marginBottom: 16 }}>
            Couldn't check your hostel status right now. Nothing was saved, so you can try again.
          </p>
          <button type="button" className="np-btn" onClick={check}>
            Try again
          </button>
        </>
      )}
    </NeoModal>
  );
}
