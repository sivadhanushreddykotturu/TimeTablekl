import React from "react";

/** Switch between the two bunk calculators: the planner (new) and the manual one (old). */
export default function BunkModeSwitch({ mode, onChange }) {
  const option = (key, label) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === key}
      className={`np-seg__btn${mode === key ? " is-active" : ""}`}
      onClick={() => onChange(key)}
    >
      {label}
    </button>
  );

  return (
    <div className="np-seg np-seg--compact" role="tablist" aria-label="Calculator">
      {option("new", "Planner")}
      {option("old", "Manual")}
    </div>
  );
}
