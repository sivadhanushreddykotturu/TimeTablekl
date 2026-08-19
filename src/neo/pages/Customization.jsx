import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiChevronLeft,
  FiPlus,
  FiCheck,
  FiCopy,
  FiShare2,
  FiZap,
} from "react-icons/fi";
import NeoShell, { NeoModal } from "../Shell.jsx";
import ThemeCard, { ThemeMock } from "../components/ThemeCard.jsx";
import Toast from "../../components/Toast.jsx";
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
  resolveFontById,
  FONT_SIZE_PRESETS,
  DEFAULT_FONT_SIZE,
  applyFontSize,
  saveActiveFontSizeId,
  getActiveFontSizeId,
  resolveFontSizeById,
  ACCENT_SWATCHES,
  SECONDARY_SWATCHES,
  DANGER_SWATCHES,
  suggestHarmony,
  encodeThemeCode,
  decodeThemeCode,
} from "../utils/themeEngine";

// ── Customization Page ───────────────────────────────────────────
export default function Customization() {
  const navigate = useNavigate();

  // Active selections
  const [activeId, setActiveId] = useState(() => getActiveThemeId() || DEFAULT_THEME.id);
  const [customThemes, setCustomThemes] = useState(() => getUserThemes());
  const [activeFontId, setActiveFontId] = useState(() => getActiveFontId() || DEFAULT_FONT.id);
  const [activeFontSizeId, setActiveFontSizeId] = useState(() => getActiveFontSizeId() || DEFAULT_FONT_SIZE.id);

  // Editor modal state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAccent, setEditAccent] = useState("#cfff04");
  const [editSecondary, setEditSecondary] = useState("#6533f4");
  const [editDanger, setEditDanger] = useState("#ff2e63");
  const [editBaseId, setEditBaseId] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Share / import state
  const [shareTarget, setShareTarget] = useState(null); // theme object or null
  const [importCode, setImportCode] = useState("");

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const showToast = (message, type = "success") => setToast({ show: true, message, type });

  // Decoded import (live validation)
  const importResult = useMemo(() => decodeThemeCode(importCode), [importCode]);
  const importTheme = useMemo(
    () =>
      importResult
        ? buildTheme("__import__", "imported", importResult.accent, importResult.secondary, importResult.danger)
        : null,
    [importResult]
  );

  // Draft theme for the editor preview (scoped to the modal mock only)
  const draftTheme = useMemo(
    () => buildTheme("__draft__", editName || "preview", editAccent, editSecondary, editDanger),
    [editName, editAccent, editSecondary, editDanger]
  );

  // ── Apply helpers ─────────────────────────────────────────────
  function selectTheme(theme) {
    applyTheme(theme);
    saveActiveThemeId(theme.id);
    setActiveId(theme.id);
  }

  function selectFont(font) {
    applyFont(font);
    saveActiveFontId(font.id);
    setActiveFontId(font.id);
  }

  function selectFontSize(preset) {
    applyFontSize(preset.scale);
    saveActiveFontSizeId(preset.id);
    setActiveFontSizeId(preset.id);
  }

  // ── Editor ────────────────────────────────────────────────────
  function openEditor(baseTheme, isExistingCustom = false) {
    setEditAccent(baseTheme.accent);
    setEditSecondary(baseTheme.secondary);
    setEditDanger(baseTheme.danger);
    setEditName(isExistingCustom ? baseTheme.name : "");
    setEditBaseId(isExistingCustom ? baseTheme.id : null);
    setShowAdvanced(false);
    setEditing(true);
  }

  function openNewEditor() {
    const active = resolveThemeById(activeId) || DEFAULT_THEME;
    openEditor(active, false);
  }

  function autoMatch() {
    const { secondary, danger } = suggestHarmony(editAccent);
    setEditSecondary(secondary);
    setEditDanger(danger);
  }

  function saveCustomTheme() {
    const name = editName.trim() || `Custom ${customThemes.length + 1}`;
    const id = editBaseId || `custom_${Date.now()}`;
    const theme = buildTheme(id, name, editAccent, editSecondary, editDanger);

    const updated = editBaseId
      ? customThemes.map((t) => (t.id === editBaseId ? theme : t))
      : [...customThemes, theme];

    saveUserThemes(updated);
    setCustomThemes(updated);
    selectTheme(theme);
    setEditing(false);
    showToast(editBaseId ? "Theme updated." : "Theme saved.");
  }

  function deleteCustom(id) {
    const updated = customThemes.filter((t) => t.id !== id);
    saveUserThemes(updated);
    setCustomThemes(updated);
    if (activeId === id) selectTheme(DEFAULT_THEME);
  }

  // ── Share / import ────────────────────────────────────────────
  const shareCode = shareTarget
    ? encodeThemeCode(shareTarget, activeFontId, activeFontSizeId)
    : "";

  async function copyShareCode() {
    try {
      await navigator.clipboard.writeText(shareCode);
      showToast("Code copied — send it to a friend.");
    } catch {
      // Clipboard fallback (older browsers / insecure context)
      const ta = document.createElement("textarea");
      ta.value = shareCode;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        showToast("Code copied — send it to a friend.");
      } catch {
        showToast("Copy failed — long-press the code instead.", "error");
      }
      document.body.removeChild(ta);
    }
  }

  function applyImport() {
    if (!importResult || !importTheme) return;
    const theme = buildTheme(
      `custom_${Date.now()}`,
      `Imported ${customThemes.length + 1}`,
      importResult.accent,
      importResult.secondary,
      importResult.danger
    );
    const updated = [...customThemes, theme];
    saveUserThemes(updated);
    setCustomThemes(updated);
    selectTheme(theme);
    selectFont(resolveFontById(importResult.fontId));
    selectFontSize(resolveFontSizeById(importResult.fontSizeId));
    setImportCode("");
    showToast("Imported — enjoy the new look.");
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

      {/* ── SHARE & IMPORT ──────────────────────────────────────── */}
      <section className="np-panel" style={{ marginBottom: 8 }}>
        <div className="np-panel__label">theme codes</div>
        <p className="np-note" style={{ marginBottom: 12 }}>
          one code = the full look — colors, font &amp; size. share yours or
          paste a friend's.
        </p>
        <button
          className="np-btn np-btn--sm"
          onClick={() => setShareTarget(resolveThemeById(activeId) || DEFAULT_THEME)}
        >
          <FiShare2 size={12} style={{ marginRight: 6 }} />
          share my current setup
        </button>

        <div className="np-import-row">
          <input
            type="text"
            className="np-field__input"
            placeholder="paste code — TTK1-…"
            value={importCode}
            onChange={(e) => setImportCode(e.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            className="np-btn np-btn--sm"
            onClick={applyImport}
            disabled={!importResult}
          >
            apply
          </button>
        </div>

        {importCode.trim() !== "" && !importResult && (
          <p className="np-import-err">that code doesn't look right — check for typos.</p>
        )}

        {importResult && importTheme && (
          <div className="np-import-preview">
            <div className="np-import-preview__mock">
              <ThemeMock theme={importTheme} />
            </div>
            <div className="np-import-preview__meta">
              <span className="np-import-preview__title">looks legit.</span>
              <span className="np-import-preview__sub">
                {resolveFontById(importResult.fontId).name} ·{" "}
                {resolveFontSizeById(importResult.fontSizeId).name}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ── PRESETS ──────────────────────────────────────────────── */}
      <div className="np-panel__label" style={{ margin: "16px 0 10px" }}>presets</div>
      <div className="np-tcard-grid">
        {PRESETS.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            active={activeId === theme.id}
            onSelect={() => selectTheme(theme)}
            onEdit={() => openEditor(theme)}
            onShare={() => setShareTarget(theme)}
          />
        ))}
      </div>

      {/* ── MY THEMES ───────────────────────────────────────────── */}
      <div className="np-panel__label" style={{ margin: "24px 0 10px" }}>my themes</div>
      <div className="np-tcard-grid">
        {customThemes.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            active={activeId === theme.id}
            onSelect={() => selectTheme(theme)}
            onEdit={() => openEditor(theme, true)}
            onShare={() => setShareTarget(theme)}
            onDelete={() => deleteCustom(theme.id)}
          />
        ))}

        {/* Create new theme card */}
        <button className="np-tcard np-tcard--add" onClick={openNewEditor}>
          <span className="np-tcard__add-icon">
            <FiPlus size={20} />
          </span>
          <span className="np-tcard__name">new theme</span>
        </button>
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

      {/* ── THEME EDITOR MODAL ──────────────────────────────────── */}
      <NeoModal
        open={editing}
        title={editBaseId ? "edit theme" : "create theme"}
        onClose={() => setEditing(false)}
        wide
      >
        {/* Scoped live preview — doesn't touch the real app theme */}
        <div className="np-editor-preview">
          <ThemeMock theme={draftTheme} />
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

        {/* Accent swatches */}
        <SwatchRow label="accent" swatches={ACCENT_SWATCHES} value={editAccent} onChange={setEditAccent} />

        {/* Secondary swatches + auto-match */}
        <div className="np-swatch-head">
          <span className="np-theme-editor__label">secondary</span>
          <button className="np-minibtn" onClick={autoMatch} title="Auto-pick secondary & danger from accent">
            <FiZap size={10} style={{ marginRight: 4 }} />
            auto-match
          </button>
        </div>
        <SwatchGrid swatches={SECONDARY_SWATCHES} value={editSecondary} onChange={setEditSecondary} />

        {/* Danger swatches */}
        <SwatchRow label="danger" swatches={DANGER_SWATCHES} value={editDanger} onChange={setEditDanger} />

        {/* Advanced: raw color inputs */}
        <button className="np-editor-adv-toggle" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? "hide custom colors" : "pick custom colors instead"}
        </button>
        {showAdvanced && (
          <div className="np-theme-editor__colors">
            <ColorPicker label="accent" value={editAccent} onChange={setEditAccent} />
            <ColorPicker label="secondary" value={editSecondary} onChange={setEditSecondary} />
            <ColorPicker label="danger" value={editDanger} onChange={setEditDanger} />
          </div>
        )}

        {/* Actions */}
        <div className="np-theme-editor__actions">
          <button className="np-btn np-btn--sm" onClick={saveCustomTheme}>
            save theme
          </button>
          <button
            className="np-btn np-btn--sm np-btn--ghost"
            onClick={() => setEditing(false)}
            style={{ marginLeft: 8 }}
          >
            cancel
          </button>
        </div>
      </NeoModal>

      {/* ── SHARE MODAL ─────────────────────────────────────────── */}
      <NeoModal open={!!shareTarget} title="share this look" onClose={() => setShareTarget(null)}>
        {shareTarget && (
          <>
            <div className="np-editor-preview">
              <ThemeMock theme={shareTarget} />
            </div>
            <p className="np-note" style={{ marginBottom: 10 }}>
              anyone who enters this code gets the exact same look — colors,
              font &amp; size.
            </p>
            <div className="np-code">{shareCode}</div>
            <button className="np-btn np-btn--sm" onClick={copyShareCode}>
              <FiCopy size={12} style={{ marginRight: 6 }} />
              copy code
            </button>
          </>
        )}
      </NeoModal>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />

      {/* Spacer for bottom nav */}
      <div style={{ height: 80 }} />
    </NeoShell>
  );
}

// ── Swatch Row (label + grid) ────────────────────────────────────
function SwatchRow({ label, swatches, value, onChange }) {
  return (
    <>
      <span className="np-theme-editor__label" style={{ display: "block", margin: "12px 0 6px" }}>
        {label}
      </span>
      <SwatchGrid swatches={swatches} value={value} onChange={onChange} />
    </>
  );
}

// ── Swatch Grid ──────────────────────────────────────────────────
function SwatchGrid({ swatches, value, onChange }) {
  return (
    <div className="np-swatches">
      {swatches.map((hex) => (
        <button
          key={hex}
          className={`np-swatch${value.toLowerCase() === hex.toLowerCase() ? " np-swatch--on" : ""}`}
          style={{ background: hex }}
          onClick={() => onChange(hex)}
          title={hex}
          aria-label={hex}
        />
      ))}
    </div>
  );
}

// ── Color Picker Sub-component (advanced) ────────────────────────
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
