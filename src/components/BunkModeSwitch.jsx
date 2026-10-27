import React from "react";

// New / Old switch shown at the top of both bunk calculators
export default function BunkModeSwitch({ mode, onChange }) {
  const tab = (key, label) => (
    <button
      type="button"
      onClick={() => onChange(key)}
      style={{
        background: "none",
        border: 0,
        borderBottom: `2px solid ${mode === key ? "var(--primary-color, var(--np-acid, #cfff04))" : "transparent"}`,
        borderRadius: 0,
        padding: "0 0 4px",
        margin: 0,
        font: "600 12px inherit",
        fontFamily: "inherit",
        color: mode === key ? "var(--text-primary, var(--np-cream, #fff))" : "var(--text-secondary, var(--np-muted, #888))",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, marginBottom: 10 }}>
      {tab("new", "New")}
      {tab("old", "Old")}
    </div>
  );
}
