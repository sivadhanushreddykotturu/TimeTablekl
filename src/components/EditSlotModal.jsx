import React, { useEffect, useState } from "react";
import { NeoModal } from "../neo/Shell.jsx";
import { getStoredRawSlots, saveSlotDetails, DEFAULT_RAW_SLOTS, SLOT_KEYS } from "../utils/examSlots";

/** Sheet for adjusting when each exam slot (MN, AM, FN, PM, EN) starts and ends. */
export default function EditSlotModal({ isOpen, onClose, onSave }) {
  // { MN: { start: "HH:MM", end: "HH:MM" }, ... }
  const [slots, setSlots] = useState(DEFAULT_RAW_SLOTS);

  useEffect(() => {
    if (isOpen) setSlots(getStoredRawSlots() || DEFAULT_RAW_SLOTS);
  }, [isOpen]);

  const change = (key, field, value) =>
    setSlots((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const save = () => {
    onSave(saveSlotDetails(slots));
    onClose();
  };

  return (
    <NeoModal open={isOpen} title="Slot timings" onClose={onClose}>
      <p className="np-note" style={{ marginBottom: 16 }}>
        Set these if your exam slots run at different times.
      </p>

      <div className="np-slotgrid">
        <span />
        <span className="np-slotgrid__head">Starts</span>
        <span className="np-slotgrid__head">Ends</span>
        {SLOT_KEYS.map((key) => (
          <React.Fragment key={key}>
            <span className="np-slotgrid__key">{key}</span>
            <input
              type="time"
              className="np-field__input"
              aria-label={`${key} starts`}
              value={slots[key]?.start || ""}
              onChange={(e) => change(key, "start", e.target.value)}
            />
            <input
              type="time"
              className="np-field__input"
              aria-label={`${key} ends`}
              value={slots[key]?.end || ""}
              onChange={(e) => change(key, "end", e.target.value)}
            />
          </React.Fragment>
        ))}
      </div>

      <div className="np-modal__actions">
        <button type="button" className="np-btn np-btn--quiet" onClick={() => setSlots(DEFAULT_RAW_SLOTS)}>
          Reset
        </button>
        <button type="button" className="np-btn" onClick={save}>
          Save
        </button>
      </div>
    </NeoModal>
  );
}
