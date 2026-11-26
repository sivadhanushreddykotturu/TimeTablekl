import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MdAccessTime, MdCalendarMonth, MdChevronLeft, MdChevronRight, MdClose } from "react-icons/md";

/* Date and time pickers in the app's own style (the browser's built-in popups can't be themed).
   Each opens as its own small sheet above the page, so the form underneath never changes size. */

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** The floating sheet. Escape closes only this, not the form behind it. */
function Layer({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <div className="np-pick-layer" onClick={onClose}>
      <div className="np-pick-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="np-pick-sheet__head">
          <span className="np-pick-sheet__title">{title}</span>
          <button type="button" className="np-pick__nav" onClick={onClose} aria-label="Close">
            <MdClose size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function Shell({ id, label, text, placeholder, icon, disabled, open, setOpen, children }) {
  return (
    <div className="np-field np-pick">
      <div className="np-field__head">
        <span className="np-field__label">{label}</span>
      </div>
      <button
        type="button"
        id={id}
        className={`np-pick__btn${open ? " is-open" : ""}`}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className={text ? undefined : "np-pick__ph"}>{text || placeholder}</span>
        {icon}
      </button>
      {open && (
        <Layer title={label} onClose={() => setOpen(false)}>
          {children}
        </Layer>
      )}
    </div>
  );
}

/** value / min are "YYYY-MM-DD"; days before `min` can't be picked. */
export function NeoDatePicker({ id, label, value, onChange, min, placeholder = "Choose a date" }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const d = value ? fromISO(value) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const today = toISO(new Date());

  const cells = useMemo(() => {
    const start = new Date(view.getFullYear(), view.getMonth(), 1 - new Date(view.getFullYear(), view.getMonth(), 1).getDay());
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [view]);

  const shift = (months) => setView((v) => new Date(v.getFullYear(), v.getMonth() + months, 1));
  const canPrev = !min || new Date(view.getFullYear(), view.getMonth(), 0) >= fromISO(min);
  const pick = (iso) => {
    onChange(iso);
    setOpen(false);
  };

  const text = value
    ? fromISO(value).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    : "";

  return (
    <Shell id={id} label={label} text={text} placeholder={placeholder} icon={<MdCalendarMonth size={20} />} open={open} setOpen={setOpen}>
      <div className="np-pick__head">
        <button type="button" className="np-pick__nav" aria-label="Previous month" disabled={!canPrev} onClick={() => shift(-1)}>
          <MdChevronLeft size={22} />
        </button>
        <span className="np-pick__month">{view.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>
        <button type="button" className="np-pick__nav" aria-label="Next month" onClick={() => shift(1)}>
          <MdChevronRight size={22} />
        </button>
      </div>

      <div className="np-pick__week" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="np-pick__grid" role="grid">
        {cells.map((d) => {
          const iso = toISO(d);
          const classes = ["np-pick__day"];
          if (d.getMonth() !== view.getMonth()) classes.push("is-out");
          if (iso === today) classes.push("is-today");
          if (iso === value) classes.push("is-selected");
          return (
            <button
              key={iso}
              type="button"
              className={classes.join(" ")}
              disabled={Boolean(min) && iso < min}
              aria-label={d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              aria-pressed={iso === value}
              onClick={() => pick(iso)}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      <div className="np-pick__foot">
        <button type="button" className="np-chipbtn" disabled={Boolean(min) && today < min} onClick={() => pick(today)}>
          Today
        </button>
      </div>
    </Shell>
  );
}

const SLOTS = Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`);

/** value and options are "HH:MM"; options defaults to every half hour. */
export function NeoTimePicker({
  id,
  label,
  value,
  onChange,
  options = SLOTS,
  disabled = false,
  placeholder = "Choose a time",
  emptyText = "No times available",
}) {
  const [open, setOpen] = useState(false);
  const list = useRef(null);

  // open on the chosen time, not at midnight
  useEffect(() => {
    if (!open || !list.current) return;
    const chosen = list.current.querySelector(".is-selected");
    if (chosen) list.current.scrollTop = chosen.offsetTop - list.current.clientHeight / 2 + chosen.clientHeight / 2;
  }, [open]);

  return (
    <Shell id={id} label={label} text={value} placeholder={placeholder} icon={<MdAccessTime size={20} />} disabled={disabled} open={open} setOpen={setOpen}>
      {options.length === 0 ? (
        <p className="np-pick__empty">{emptyText}</p>
      ) : (
        <div className="np-pick__times" ref={list}>
          {options.map((t) => (
            <button
              key={t}
              type="button"
              className={`np-pick__slot${t === value ? " is-selected" : ""}`}
              aria-pressed={t === value}
              onClick={() => {
                onChange(t);
                setOpen(false);
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </Shell>
  );
}
