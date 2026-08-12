import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FiChevronLeft, FiPlus, FiX, FiCheck, FiSliders, FiTrash2 } from "react-icons/fi";
import NeoShell from "../Shell.jsx";
import {
  PRESETS,
  DEFAULT_THEME,
  buildTheme,
  applyTheme,
  saveActiveThemeId,
  getActiveThemeId,
  getUserThemes,
  saveUserThemes,
  resolveThemeById,
  FONT_PRESETS,
  DEFAULT_FONT,
  applyFont,
  saveActiveFontId,
  getActiveFontId,
  FONT_SIZE_PRESETS,
  DEFAULT_FONT_SIZE,
  applyFontSize,
  saveActiveFontSizeId,
  getActiveFontSizeId,
} from "../utils/themeEngine";

// ── Customization Page ───────────────────────────────────────────
export default function Customization() {
  const navigate = useNavigate();

  // Active theme state
  const [activeId, setActiveId] = useState(() => getActiveThemeId() || DEFAULT_THEME.id);
  const [customThemes, setCustomThemes] = useState(() => getUserThemes());
  const [activeFontId, setActiveFontId] = useState(() => getActiveFontId() || DEFAULT_FONT.id);
  const [activeFontSizeId, setActiveFontSizeId] = useState(() => getActiveFontSizeId() || DEFAULT_FONT_SIZE.id);

  // Editor state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAccent, setEditAccent] = useState("#cfff04");
  const [editSecondary, setEditSecondary] = useState("#6533f4");
  const [editDanger, setEditDanger] = useState("#ff2e63");
  const [editBaseId, setEditBaseId] = useState(null); // if editing an existing custom theme

  // All themes combined for rendering
  const allThemes = [...PRESETS, ...customThemes];

  // ── Apply a theme ─────────────────────────────────────────────
  function selectTheme(theme) {
    applyTheme(theme);
    saveActiveThemeId(theme.id);
    setActiveId(theme.id);
  }

  // ── Apply a font ──────────────────────────────────────────────
  function selectFont(font) {
    applyFont(font);
    saveActiveFontId(font.id);
    setActiveFontId(font.id);
  }

  // ── Apply a font size ──────────────────────────────────────────
  function selectFontSize(preset) {
    applyFontSize(preset.scale);
    saveActiveFontSizeId(preset.id);
    setActiveFontSizeId(preset.id);
  }

  // ── Open editor ───────────────────────────────────────────────
  function openEditor(baseTheme, isExistingCustom = false) {
    setEditAccent(baseTheme.accent);
    setEditSecondary(baseTheme.secondary);
    setEditDanger(baseTheme.danger);
    setEditName(isExistingCustom ? baseTheme.name : "");
    setEditBaseId(isExistingCustom ? baseTheme.id : null);
    setEditing(true);
  }

  function openNewEditor() {
    const active = resolveThemeById(activeId) || DEFAULT_THEME;
    setEditAccent(active.accent);
    setEditSecondary(active.secondary);
    setEditDanger(active.danger);
    setEditName("");
    setEditBaseId(null);
    setEditing(true);
  }

  // ── Save custom theme ─────────────────────────────────────────
  function saveCustomTheme() {
    const name = editName.trim() || `Custom ${customThemes.length + 1}`;
    const id = editBaseId || `custom_${Date.now()}`;
    const theme = buildTheme(id, name, editAccent, editSecondary, editDanger);

    let updated;
    if (editBaseId) {
      // Editing existing custom theme
      updated = customThemes.map((t) => (t.id === editBaseId ? theme : t));
    } else {
      // Creating new
      updated = [...customThemes, theme];
    }

    saveUserThemes(updated);
    setCustomThemes(updated);
    selectTheme(theme);
    setEditing(false);
  }

  // ── Delete custom theme ───────────────────────────────────────
  function deleteCustom(id) {
    const updated = customThemes.filter((t) => t.id !== id);
    saveUserThemes(updated);
    setCustomThemes(updated);
    // If deleted theme was active, fall back to default
    if (activeId === id) {
      selectTheme(DEFAULT_THEME);
    }
  }

  // Live preview while editing
  useEffect(() => {
    if (!editing) return;
    const preview = buildTheme("__preview__", "Preview", editAccent, editSecondary, editDanger);
    applyTheme(preview);
  }, [editing, editAccent, editSecondary, editDanger]);

  // Revert on cancel
  function cancelEditor() {
    setEditing(false);
    const theme = resolveThemeById(activeId) || DEFAULT_THEME;
    applyTheme(theme);
  }

  return (
    <NeoShell>
      <div className="np-pagehead">
        <span className="np-eyebrow">your space</span>
        <h1 className="np-pagehead__title">customize<i>.</i></h1>
      </div>

      {/* Back button */}
      <button
        className="np-linkrow"
        onClick={() => navigate("/profile")}
        style={{ marginBottom: 16 }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <FiChevronLeft size={15} /> back to profile
        </span>
      </button>

      {/* ── PRESETS ──────────────────────────────────────────────── */}
      <div className="np-panel__label" style={{ margin: "12px 0 10px" }}>presets</div>
      <div className="np-theme-row">
        {PRESETS.map((theme) => (
          <div key={theme.id} className="np-theme-circle-wrap">
            <button
              className={`np-theme-circle${activeId === theme.id ? " np-theme-circle--active" : ""}`}
              style={{ background: theme.accent }}
              onClick={() => selectTheme(theme)}
              title={theme.name}
            >
              {activeId === theme.id && <FiCheck size={16} strokeWidth={3} color="#000" />}
            </button>
            <span className="np-theme-circle__label">{theme.name}</span>
            <div className="np-theme-circle__actions">
              <button
                className="np-theme-action-btn"
                onClick={(e) => { e.stopPropagation(); openEditor(theme); }}
                title={`Customize ${theme.name}`}
              >
                <FiSliders size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── MY THEMES ───────────────────────────────────────────── */}
      <div className="np-panel__label" style={{ margin: "20px 0 10px" }}>my themes</div>
      <div className="np-theme-row">
        {customThemes.map((theme) => (
          <div key={theme.id} className="np-theme-circle-wrap">
            <button
              className={`np-theme-circle${activeId === theme.id ? " np-theme-circle--active" : ""}`}
              style={{ background: theme.accent }}
              onClick={() => selectTheme(theme)}
              title={theme.name}
            >
              {activeId === theme.id && <FiCheck size={16} strokeWidth={3} color="#000" />}
            </button>
            <span className="np-theme-circle__label">{theme.name}</span>
            <div className="np-theme-circle__actions">
              <button
                className="np-theme-action-btn"
                onClick={(e) => { e.stopPropagation(); openEditor(theme, true); }}
                title={`Edit ${theme.name}`}
              >
                <FiSliders size={12} />
              </button>
              <button
                className="np-theme-action-btn np-theme-action-btn--del"
                onClick={(e) => { e.stopPropagation(); deleteCustom(theme.id); }}
                title="Delete theme"
              >
                <FiTrash2 size={12} />
              </button>
            </div>
          </div>
        ))}

        {/* Create new theme button */}
        <div className="np-theme-circle-wrap">
          <button
            className="np-theme-circle np-theme-circle--add"
            onClick={openNewEditor}
            title="Create new theme"
          >
            <FiPlus size={18} />
          </button>
          <span className="np-theme-circle__label">new</span>
        </div>
      </div>

      {customThemes.length === 0 && (
        <p style={{
          font: "400 11px/1.5 var(--np-font-ui)",
          color: "var(--np-faint)",
          margin: "4px 0 0",
        }}>
          no custom themes yet — tap + to create one
        </p>
      )}

      {/* ── FONTS ────────────────────────────────────────────────── */}
      <div className="np-panel__label" style={{ margin: "24px 0 10px" }}>fonts</div>
      <div className="np-font-grid">
        {FONT_PRESETS.map((font) => (
          <button
            key={font.id}
            className={`np-font-card${activeFontId === font.id ? " np-font-card--active" : ""}`}
            onClick={() => selectFont(font)}
          >
            <div className="np-font-card__header">
              <span className="np-font-card__title" style={{ fontFamily: font.display }}>
                {font.name}
              </span>
              {activeFontId === font.id && (
                <span className="np-font-card__check">
                  <FiCheck size={14} strokeWidth={3} />
                </span>
              )}
            </div>
            <span className="np-font-card__vibe" style={{ fontFamily: font.ui }}>
              {font.vibe}
            </span>
            <div className="np-font-card__preview" style={{ fontFamily: font.ui }}>
              10:30 AM · ACSA-S Room C419A
            </div>
          </button>
        ))}
      </div>

      {/* ── FONT SIZE ───────────────────────────────────────────── */}
      <div className="np-panel__label" style={{ margin: "24px 0 10px" }}>font size</div>
      <div className="np-seg" style={{ marginBottom: 20 }}>
        {FONT_SIZE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            className={`np-seg__btn${activeFontSizeId === preset.id ? " is-active" : ""}`}
            onClick={() => selectFontSize(preset)}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* ── THEME EDITOR ────────────────────────────────────────── */}
      {editing && (
        <div className="np-theme-editor">
          <div className="np-panel__label" style={{ margin: "0 0 12px" }}>
            {editBaseId ? "edit theme" : "create theme"}
          </div>

          {/* Name */}
          <label className="np-theme-editor__field">
            <span className="np-theme-editor__label">name</span>
            <input
              type="text"
              className="np-field__input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder={`Custom ${customThemes.length + 1}`}
              maxLength={20}
            />
          </label>

          {/* Color Pickers */}
          <div className="np-theme-editor__colors">
            <ColorPicker label="accent" value={editAccent} onChange={setEditAccent} />
            <ColorPicker label="secondary" value={editSecondary} onChange={setEditSecondary} />
            <ColorPicker label="danger" value={editDanger} onChange={setEditDanger} />
          </div>

          {/* Live Preview */}
          <div className="np-theme-editor__preview">
            <span className="np-theme-editor__preview-label">preview</span>
            <div className="np-theme-editor__preview-strip">
              <div className="np-theme-editor__swatch" style={{ background: editAccent }}>
                <span>Aa</span>
              </div>
              <div className="np-theme-editor__swatch" style={{ background: editSecondary }}>
                <span>Bb</span>
              </div>
              <div className="np-theme-editor__swatch" style={{ background: editDanger }}>
                <span>!</span>
              </div>
              <div className="np-theme-editor__swatch np-theme-editor__swatch--dark" style={{ borderColor: editAccent }}>
                <span style={{ color: editAccent }}>text</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="np-theme-editor__actions">
            <button className="np-btn np-btn--sm" onClick={saveCustomTheme}>
              save theme
            </button>
            <button
              className="np-btn np-btn--sm np-btn--ghost"
              onClick={cancelEditor}
              style={{ marginLeft: 8 }}
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {/* Spacer for bottom nav */}
      <div style={{ height: 80 }} />
    </NeoShell>
  );
}

// ── Color Picker Sub-component ───────────────────────────────────
function ColorPicker({ label, value, onChange }) {
  const inputRef = useRef(null);

  return (
    <div className="np-color-picker" onClick={() => inputRef.current?.click()}>
      <div className="np-color-picker__swatch" style={{ background: value }} />
      <div className="np-color-picker__info">
        <span className="np-color-picker__label">{label}</span>
        <span className="np-color-picker__hex">{value}</span>
      </div>
      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="np-color-picker__input"
      />
    </div>
  );
}
