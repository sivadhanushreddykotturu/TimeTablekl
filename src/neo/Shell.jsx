import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  FiHome,
  FiCalendar,
  FiPieChart,
  FiAward,
  FiUsers,
  FiRefreshCw,
  FiX,
} from "react-icons/fi";
import { getCurrentAcademicYearOptions } from "../config/api.js";
import { NeoSelect, NeoButton } from "./NeoKit.jsx";
import "./neo.css";

/* ============================================================
   NeoModal — shared neoPOP modal
   ============================================================ */

export function NeoModal({ open, title, onClose, children, wide = false }) {
  if (!open) return null;
  return (
    <div className="np-modal-overlay" onClick={onClose}>
      <div
        className="np-modal"
        style={wide ? { maxWidth: 560 } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="np-modal__head">
          <h2 className="np-modal__title">{title}</h2>
          {onClose && (
            <button className="np-modal__close" onClick={onClose} aria-label="Close">
              <FiX size={15} />
            </button>
          )}
        </div>
        <div className="np-modal__body">{children}</div>
      </div>
    </div>
  );
}

/* ============================================================
   Loading blocks
   ============================================================ */

export function NeoLoading({ text = "loading…" }) {
  return (
    <div className="np-loading">
      <div className="np-loading__blocks" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      <div className="np-loading__text">{text}</div>
    </div>
  );
}

/* ============================================================
   Resync sheet — semester/year picker + sync
   ============================================================ */

function ResyncSheet({ open, onClose, onSync, syncing }) {
  const [semester, setSemester] = useState("odd");
  const [academicYear, setAcademicYear] = useState("");
  const [yearOptions, setYearOptions] = useState([]);

  useEffect(() => {
    if (!open) return;
    const storedSemester = localStorage.getItem("semester") || "odd";
    const validSemesters = new Set(["odd", "even", "summer", "term3"]);
    const currentYear = new Date().getFullYear();
    const defaultYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
    const storedYear = localStorage.getItem("academicYear") || defaultYear;

    setSemester(validSemesters.has(storedSemester) ? storedSemester : "odd");
    setAcademicYear(storedYear);
    setYearOptions(Array.from(new Set([storedYear, ...getCurrentAcademicYearOptions()])));
  }, [open]);

  const handleSync = async () => {
    localStorage.setItem("semester", semester);
    localStorage.setItem("academicYear", academicYear);
    await onSync();
  };

  return (
    <NeoModal open={open} title="resync timetable" onClose={onClose}>
      <p className="np-note" style={{ marginBottom: 16 }}>
        Pulls the latest timetable from ERP for the selected semester.
      </p>

      <div className="np-row">
        <NeoSelect
          id="np-resync-sem"
          label="semester"
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
        >
          <option value="odd">Odd</option>
          <option value="even">Even</option>
          <option value="summer">Summer</option>
          <option value="term3">Term 3</option>
        </NeoSelect>

        <NeoSelect
          id="np-resync-year"
          label="academic year"
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
        >
          {yearOptions.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </NeoSelect>
      </div>

      <NeoButton type="button" onClick={handleSync} loading={syncing} loadingText="syncing…">
        sync now
      </NeoButton>
    </NeoModal>
  );
}

/* ============================================================
   NeoShell — topbar + content + bottom nav
   props:
     onRefresh     : async fn — enables the resync button
     refreshMode   : "sheet" (semester picker) | "direct"
     refreshLabel  : label for direct mode button
     examExit      : show "exit exam" action
   ============================================================ */

export default function NeoShell({
  children,
  onRefresh,
  refreshMode = "sheet",
  refreshLabel = "resync",
  examExit = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSheet, setShowSheet] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [avatarSeed] = useState(
    () => localStorage.getItem("avatarSeed") || Math.random().toString(36).substring(7)
  );

  useEffect(() => {
    localStorage.setItem("avatarSeed", avatarSeed);
  }, [avatarSeed]);

  const runRefresh = async () => {
    if (!onRefresh || syncing) return;
    setSyncing(true);
    try {
      await onRefresh();
      setSynced(true);
      setTimeout(() => setSynced(false), 2500);
      setShowSheet(false);
    } catch {
      /* page surfaces its own toast */
    } finally {
      setSyncing(false);
    }
  };

  const handleRefreshClick = () => {
    if (refreshMode === "sheet") {
      setShowSheet(true);
    } else {
      runRefresh();
    }
  };

  const handleExitExam = () => {
    localStorage.removeItem("examMode");
    navigate("/home");
  };

  const isProfile = location.pathname === "/profile";

  return (
    <div className="np-app">
      <div className="np-app__inner">
        <header className="np-topbar">
          <Link to="/home" className="np-topbar__brand" aria-label="Home">
            <span className="np-topbar__tile">kl</span>
            <span className="np-topbar__word">timetable<i>.</i></span>
          </Link>

          <div className="np-topbar__actions">
            {examExit && (
              <button className="np-iconbtn np-iconbtn--exit" onClick={handleExitExam}>
                <FiX size={13} /> exit
              </button>
            )}
            {onRefresh && (
              <button className="np-iconbtn" onClick={handleRefreshClick} disabled={syncing}>
                <FiRefreshCw size={13} className={syncing ? "np-spin" : undefined} />
                {syncing ? "syncing" : synced ? "synced" : refreshLabel}
              </button>
            )}
            <Link
              to="/profile"
              className={`np-avatar${isProfile ? " np-avatar--active" : ""}`}
              aria-label="Profile"
            >
              <img
                src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${avatarSeed}&backgroundColor=transparent`}
                alt="Profile"
              />
            </Link>
          </div>
        </header>

        <main>{children}</main>
      </div>

      <nav className="np-nav" aria-label="Main">
        <div className="np-nav__row">
          <NavLink to="/home" className={({ isActive }) => `np-nav__item${isActive ? " is-active" : ""}`}>
            <FiHome size={18} />
            <span>home</span>
            <span className="np-nav__dot" />
          </NavLink>

          <NavLink to="/timetable" className={({ isActive }) => `np-nav__item${isActive ? " is-active" : ""}`}>
            <FiCalendar size={18} />
            <span>week</span>
            <span className="np-nav__dot" />
          </NavLink>

          <NavLink to="/attendance" className={({ isActive }) => `np-nav__core${isActive ? " is-active" : ""}`}>
            <span className="np-nav__diamond">
              <FiPieChart size={19} />
            </span>
            <span className="np-nav__label">attend</span>
          </NavLink>

          <NavLink to="/grades" className={({ isActive }) => `np-nav__item${isActive ? " is-active" : ""}`}>
            <FiAward size={18} />
            <span>grades</span>
            <span className="np-nav__dot" />
          </NavLink>

          <NavLink to="/maddys" className={({ isActive }) => `np-nav__item${isActive ? " is-active" : ""}`}>
            <FiUsers size={18} />
            <span>docs</span>
            <span className="np-nav__dot" />
          </NavLink>
        </div>
      </nav>

      {refreshMode === "sheet" && (
        <ResyncSheet
          open={showSheet}
          onClose={() => setShowSheet(false)}
          onSync={runRefresh}
          syncing={syncing}
        />
      )}
    </div>
  );
}
