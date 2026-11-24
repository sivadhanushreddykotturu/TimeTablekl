import React from "react";
import { NeoModal } from "../Shell.jsx";

/** Lists the slots a timetable sync changed. Shown on Today and Week. */
export default function TimetableChangesModal({ changes, onClose }) {
  return (
    <NeoModal open={changes.length > 0} title="Timetable changes found" onClose={onClose}>
      <p className="np-note" style={{ marginBottom: 14 }}>
        These slots changed after the sync:
      </p>
      <div style={{ maxHeight: 280, overflowY: "auto" }}>
        {changes.map((change, index) => (
          <div key={`${change.day}-${change.slot}-${index}`} className="np-panel" style={{ marginBottom: 10 }}>
            <div className="np-panel__label" style={{ marginBottom: 8 }}>
              {change.day} · Slot {change.slot}
            </div>
            <div className="np-note">
              <div><b style={{ color: "var(--np-pink)" }}>Old</b> — {change.oldClass}</div>
              <div style={{ marginTop: 4 }}><b style={{ color: "var(--np-good)" }}>New</b> — {change.newClass}</div>
            </div>
          </div>
        ))}
      </div>
    </NeoModal>
  );
}
