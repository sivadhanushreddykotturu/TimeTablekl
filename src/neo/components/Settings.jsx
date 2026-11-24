import React from "react";
import { FiChevronRight } from "react-icons/fi";

/** A card of settings rows, with an optional caption above it. */
export function SettingsGroup({ title, children }) {
  return (
    <section className="np-setgroup">
      {title && <h2 className="np-setgroup__title">{title}</h2>}
      <div className="np-setgroup__card">{children}</div>
    </section>
  );
}

/**
 * One row: icon tile, title, description, and a chevron (or `trailing`).
 * Renders a button; `danger` tints it for destructive actions.
 */
export function SettingsRow({ icon, title, description, trailing, danger = false, onClick, ...props }) {
  return (
    <button
      type="button"
      className={`np-setrow${danger ? " np-setrow--danger" : ""}`}
      onClick={onClick}
      {...props}
    >
      {icon && <span className="np-setrow__icon" aria-hidden="true">{icon}</span>}
      <span className="np-setrow__text">
        <span className="np-setrow__title">{title}</span>
        {description && <span className="np-setrow__desc">{description}</span>}
      </span>
      {trailing !== undefined ? trailing : <FiChevronRight className="np-setrow__chev" size={18} aria-hidden="true" />}
    </button>
  );
}

/** Visual on/off switch for a row's trailing slot (the row itself is the control). */
export function Switch({ on }) {
  return <span className={`np-switch${on ? " is-on" : ""}`} aria-hidden="true" />;
}
