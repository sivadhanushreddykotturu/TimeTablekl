import React from "react";
import { FiCheck, FiSliders, FiShare2, FiTrash2 } from "react-icons/fi";
import { themeVars } from "../utils/themeEngine";

/* ============================================================
   ThemeCard — theme preview card with a mini app mock
   ThemeMock  — standalone mini mock (used in editor/import too)
   ============================================================ */

/** Miniature app mock painted with the given theme. */
export function ThemeMock({ theme }) {
  return (
    <div className="np-mock" style={themeVars(theme)}>
      <div className="np-mock__bar">
        <span className="np-mock__dot" />
        <span className="np-mock__title">timetablekl</span>
        <span className="np-mock__chip">live</span>
      </div>
      <div className="np-mock__card">
        <div className="np-mock__card-top">
          <span className="np-mock__subject">ACSA-S</span>
          <span className="np-mock__room">C419A</span>
        </div>
        <div className="np-mock__lines">
          <i style={{ width: "72%" }} />
          <i style={{ width: "46%" }} />
        </div>
      </div>
      <div className="np-mock__row">
        <span className="np-mock__btn">sync now</span>
        <span className="np-mock__btn np-mock__btn--danger">!</span>
      </div>
    </div>
  );
}

export default function ThemeCard({ theme, active, onSelect, onEdit, onShare, onDelete }) {
  return (
    <div className={`np-tcard${active ? " np-tcard--active" : ""}`}>
      <button
        className="np-tcard__mock"
        onClick={onSelect}
        title={`Apply ${theme.name}`}
      >
        <ThemeMock theme={theme} />
        {active && (
          <span className="np-tcard__badge">
            <FiCheck size={10} strokeWidth={3.5} /> active
          </span>
        )}
      </button>
      <div className="np-tcard__foot">
        <span className="np-tcard__name" title={theme.name}>{theme.name}</span>
        <div className="np-tcard__actions">
          {onEdit && (
            <button
              className="np-theme-action-btn"
              onClick={onEdit}
              title={onDelete ? `Edit ${theme.name}` : `Customize from ${theme.name}`}
            >
              <FiSliders size={12} />
            </button>
          )}
          {onShare && (
            <button
              className="np-theme-action-btn"
              onClick={onShare}
              title={`Share ${theme.name}`}
            >
              <FiShare2 size={12} />
            </button>
          )}
          {onDelete && (
            <button
              className="np-theme-action-btn np-theme-action-btn--del"
              onClick={onDelete}
              title={`Delete ${theme.name}`}
            >
              <FiTrash2 size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
