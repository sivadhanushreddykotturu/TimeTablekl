import React, { useEffect, useRef, useState } from "react";
import { FiChevronDown } from "react-icons/fi";

export default function SemesterPicker({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selected = options.find((opt) => opt.key === value);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleSelect = (key) => {
    onChange(key);
    setOpen(false);
  };

  return (
    <div className={`semester-picker${open ? " is-open" : ""}`} ref={rootRef}>
      {label && <span className="semester-picker-label">{label}</span>}

      <div className="semester-picker-control">
        <button
          type="button"
          className="semester-picker-trigger"
          onClick={() => setOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="semester-picker-value">
            {selected?.label || "Select semester"}
          </span>
          <FiChevronDown className="semester-picker-chevron" aria-hidden />
        </button>

        {open && (
          <ul className="semester-picker-menu" role="listbox">
            {options.map((opt) => {
              const isSelected = opt.key === value;
              return (
                <li key={opt.key} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    className={`semester-picker-option${isSelected ? " is-selected" : ""}`}
                    onClick={() => handleSelect(opt.key)}
                  >
                    <span className="semester-picker-option-text">{opt.label}</span>
                    {isSelected && <span className="semester-picker-check">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
