import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSync } from "../../contexts/SyncContext.jsx";
import { NeoModal } from "../Shell.jsx";
import Kbd from "./Kbd.jsx";
import { MOD_KEY } from "../utils/keys.js";

/**
 * Keyboard support for laptops: jump keys, a Ctrl/Cmd+K palette and a "?" cheat
 * sheet. Only mounted on wide screens with a real pointer; it never reacts
 * while the user is typing in a field.
 */

const DESTINATIONS = [
  { id: "home", label: "Today", to: "/home", keys: "1", words: "home classes schedule" },
  { id: "week", label: "Week", to: "/timetable", keys: "2", words: "timetable days" },
  { id: "attendance", label: "Attendance", to: "/attendance", keys: "3", words: "percentage bunk register" },
  { id: "profile", label: "Profile", to: "/profile", keys: "4", words: "account settings picture avatar semester" },
  { id: "exams", label: "Exams", to: "/exam", keys: "G E", words: "seating room schedule" },
  { id: "grades", label: "Grades", to: "/grades", keys: "G R", words: "marks cgpa sgpa results" },
  { id: "subjects", label: "Subject names", to: "/subjects", keys: "G S", words: "rename courses" },
  { id: "friends", label: "Friends' timetables", to: "/maddys", keys: "G F", words: "maddys docs compare" },
  { id: "calculator", label: "Attendance calculator", to: "/kl-attendance-calculator", keys: "G C", words: "kl erp weighted sick" },
];

const KEY_TO_ID = { 1: "home", 2: "week", 3: "attendance", 4: "profile" };
const G_TO_ID = { e: "exams", r: "grades", s: "subjects", f: "friends", c: "calculator" };

const SHORTCUT_ROWS = [
  ["Open the command palette", [`${MOD_KEY} K`]],
  ["Show this list", ["?"]],
  ["Today · Week · Attendance · Profile", ["1", "2", "3", "4"]],
  ["Exams · Grades · Subjects · Friends · Calculator", ["G E", "G R", "G S", "G F", "G C"]],
  ["Sync now", ["R"]],
  ["Week: previous / next day", ["←", "→"]],
  ["Week: jump to today", ["T"]],
  ["Close a dialog", ["Esc"]],
];

const typing = (event) => {
  const el = event.target;
  if (!(el instanceof Element)) return false;
  return el.closest("input, textarea, select, [contenteditable='true']") !== null;
};

export default function KeyboardLayer() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { triggerSync } = useSync();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingG = useRef(0);

  const go = useCallback(
    (to) => {
      setPaletteOpen(false);
      setHelpOpen(false);
      if (to !== pathname) navigate(to);
    },
    [navigate, pathname]
  );

  useEffect(() => {
    // the footer hint and anything else can ask for these
    const openPalette = () => setPaletteOpen(true);
    const openHelp = () => setHelpOpen(true);
    window.addEventListener("kbd_palette", openPalette);
    window.addEventListener("kbd_help", openHelp);
    return () => {
      window.removeEventListener("kbd_palette", openPalette);
      window.removeEventListener("kbd_help", openHelp);
    };
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      // Ctrl/Cmd+K works everywhere, even inside a field
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setHelpOpen(false);
        setPaletteOpen((open) => !open);
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (typing(event) || paletteOpen) return;

      const key = event.key.toLowerCase();

      if (event.key === "?") {
        event.preventDefault();
        setHelpOpen((open) => !open);
        return;
      }
      if (helpOpen) return;

      // "g" then a letter
      if (performance.now() - pendingG.current < 900) {
        pendingG.current = 0;
        const id = G_TO_ID[key];
        if (id) {
          event.preventDefault();
          go(DESTINATIONS.find((d) => d.id === id).to);
          return;
        }
      }
      if (key === "g") {
        pendingG.current = performance.now();
        return;
      }

      if (KEY_TO_ID[key]) {
        event.preventDefault();
        go(DESTINATIONS.find((d) => d.id === KEY_TO_ID[key]).to);
        return;
      }
      if (key === "r") {
        event.preventDefault();
        triggerSync();
        return;
      }
      if (pathname === "/timetable") {
        if (event.key === "ArrowLeft") window.dispatchEvent(new CustomEvent("kbd_day", { detail: "prev" }));
        else if (event.key === "ArrowRight") window.dispatchEvent(new CustomEvent("kbd_day", { detail: "next" }));
        else if (key === "t") window.dispatchEvent(new CustomEvent("kbd_day", { detail: "today" }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, paletteOpen, helpOpen, pathname, triggerSync]);

  return (
    <>
      <Palette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onGo={go}
        onSync={() => {
          setPaletteOpen(false);
          triggerSync();
        }}
        onHelp={() => {
          setPaletteOpen(false);
          setHelpOpen(true);
        }}
      />
      <NeoModal open={helpOpen} title="Keyboard shortcuts" onClose={() => setHelpOpen(false)}>
        <div className="np-kbd-list">
          {SHORTCUT_ROWS.map(([label, keys]) => (
            <div key={label} className="np-kbd-list__row">
              <span>{label}</span>
              <span className="np-kbd-list__keys">
                {keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
        <p className="np-note" style={{ marginTop: 14 }}>
          Shortcuts pause while you are typing in a box.
        </p>
      </NeoModal>
    </>
  );
}

function Palette({ open, onClose, onGo, onSync, onHelp }) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef(null);

  const items = useMemo(() => {
    const all = [
      ...DESTINATIONS.map((d) => ({ id: d.id, label: d.label, hint: `Go to · ${d.keys}`, words: d.words, run: () => onGo(d.to) })),
      { id: "sync", label: "Sync now", hint: "Action · R", words: "refresh update erp", run: onSync },
      { id: "help", label: "Keyboard shortcuts", hint: "Action · ?", words: "help keys", run: onHelp },
    ];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((item) => `${item.label} ${item.words}`.toLowerCase().includes(q));
  }, [query, onGo, onSync, onHelp]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  if (!open) return null;

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      items[index]?.run();
    }
  };

  return (
    <NeoModal open title="Go to…" onClose={onClose}>
      <input
        ref={inputRef}
        className="np-field__input np-palette__input"
        type="text"
        value={query}
        placeholder="Type a screen or action"
        aria-label="Search screens and actions"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="np-palette__list" role="listbox">
        {items.length === 0 && <p className="np-note">Nothing matches “{query}”.</p>}
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={i === index}
            className={`np-palette__item${i === index ? " is-on" : ""}`}
            onMouseEnter={() => setIndex(i)}
            onClick={item.run}
          >
            <span>{item.label}</span>
            <small>{item.hint}</small>
          </button>
        ))}
      </div>
    </NeoModal>
  );
}
