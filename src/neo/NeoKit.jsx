import React, { useState } from "react";

/* ============================================================
   Component kit — primitives shared by all neo pages
   ============================================================ */

/** Primary button with a built-in loading state. */
export function NeoButton({ children, loading = false, loadingText = "working…", ...props }) {
  return (
    <div className="np-btn-zone">
      <button type="submit" className="np-btn" disabled={loading} {...props}>
        {loading ? loadingText : children}
      </button>
    </div>
  );
}

/** Labeled text input. Set type="password" to get a show/hide toggle. */
export function NeoField({ label, type = "text", ...props }) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="np-field">
      <div className="np-field__head">
        <label className="np-field__label" htmlFor={props.id}>{label}</label>
        {isPassword && (
          <button
            type="button"
            className="np-peek"
            onClick={() => setRevealed(v => !v)}
            aria-label={revealed ? "Hide password" : "Show password"}
          >
            {revealed ? "hide" : "show"}
          </button>
        )}
      </div>
      <input
        className="np-field__input"
        type={isPassword ? (revealed ? "text" : "password") : type}
        {...props}
      />
    </div>
  );
}

/** Labeled select. */
export function NeoSelect({ label, children, ...props }) {
  return (
    <div className="np-field">
      <div className="np-field__head">
        <label className="np-field__label" htmlFor={props.id}>{label}</label>
      </div>
      <select className="np-field__input" {...props}>
        {children}
      </select>
    </div>
  );
}

/** Card surface. */
export function NeoCard({ children, ...props }) {
  return (
    <div className="np-card" {...props}>
      {children}
    </div>
  );
}
