import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import NeoShell, { NeoModal } from "../Shell.jsx";
import CampusRadio from "../components/CampusRadio.jsx";
import ClassTimer, { ClassTimerReadout, ClassProgressBar } from "../components/ClassTimer.jsx";
import AnnouncementBanner from "../components/AnnouncementBanner.jsx";
import Toast from "../../components/Toast.jsx";

import { syncTimetable } from "../../../utils/syncTimetable.js";
import { replaceCourseCodeWithCustomName } from "../../utils/subjectMapper";
import { trackEvent } from "../../utils/analytics";
import { getSlotTimes, getMaxSlots, formatTimeStr } from "../../utils/slotTimes";

function getCurrentSlotNumber() {
  const slotTimes = getSlotTimes();
  const maxSlots = getMaxSlots();
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (let slot = 1; slot <= maxSlots; slot++) {
    const [sh, sm] = slotTimes[slot].start.split(":").map(Number);
    const [eh, em] = slotTimes[slot].end.split(":").map(Number);
    const startM = sh * 60 + sm;
    const endM = eh * 60 + em;

    if (currentMinutes >= startM && currentMinutes < endM) return slot;
  }
  return null;
}

function findCurrentAndNextClass(timetable) {
  const slotTimes = getSlotTimes();
  const maxSlots = getMaxSlots();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = days[new Date().getDay()];
  const slots = timetable?.[today] || {};

  const currentSlot = getCurrentSlotNumber();

  const entries = Object.entries(slots)
    .filter(([slot]) => parseInt(slot) <= maxSlots)
    .map(([slot, value]) => [parseInt(slot), value]);

  let currentBlock = null;
  let nextBlock = null;

  const merged = [];
  let i = 0;

  while (i < entries.length) {
    const [startSlot, value] = entries[i];
    if (value === "-") {
      i++;
      continue;
    }

    let endSlot = startSlot;
    while (
      i + 1 < entries.length &&
      entries[i + 1][1] === value &&
      entries[i + 1][0] === endSlot + 1
    ) {
      endSlot++;
      i++;
    }

    merged.push({ content: value, startSlot, endSlot });
    i++;
  }

  if (currentSlot) {
    for (const block of merged) {
      if (currentSlot >= block.startSlot && currentSlot <= block.endSlot) {
        currentBlock = block;
        break;
      }
    }
    for (const block of merged) {
      if (block.startSlot > currentSlot) {
        nextBlock = block;
        break;
      }
    }
  } else {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const block of merged) {
      const [sh, sm] = slotTimes[block.startSlot].start.split(":").map(Number);
      const startMinutes = sh * 60 + sm;

      if (startMinutes > currentMinutes) {
        nextBlock = block;
        break;
      }
    }
  }

  const toInfo = (block) => {
    if (!block) return null;
    const formatSetting = localStorage.getItem("time_format") || "12";
    const slotStr = block.startSlot === block.endSlot ? `Slot ${block.startSlot}` : `Slots ${block.startSlot}–${block.endSlot}`;
    const startFormatted = formatTimeStr(slotTimes[block.startSlot].start, formatSetting);
    const endFormatted = formatTimeStr(slotTimes[block.endSlot].end, formatSetting);

    const now = new Date();
    const [sh, sm] = slotTimes[block.startSlot].start.split(":").map(Number);
    const [eh, em] = slotTimes[block.endSlot].end.split(":").map(Number);
    const startTimeMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm, 0, 0).getTime();
    const endTimeMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), eh, em, 0, 0).getTime();

    return {
      name: replaceCourseCodeWithCustomName(block.content),
      time: `${startFormatted} – ${endFormatted} · [${slotStr}]`,
      startTimeMs,
      endTimeMs,
    };
  };

  return { current: toInfo(currentBlock), next: toInfo(nextBlock) };
}

function getTimetableChanges(oldTimetable = {}, newTimetable = {}) {
  const changes = [];
  const allDays = Array.from(new Set([
    ...Object.keys(oldTimetable || {}),
    ...Object.keys(newTimetable || {})
  ]));

  allDays.forEach((day) => {
    const oldSlots = oldTimetable?.[day] || {};
    const newSlots = newTimetable?.[day] || {};
    const allSlots = Array.from(new Set([
      ...Object.keys(oldSlots),
      ...Object.keys(newSlots)
    ])).sort((a, b) => Number(a) - Number(b));

    allSlots.forEach((slot) => {
      const oldClass = oldSlots[slot] || "-";
      const newClass = newSlots[slot] || "-";

      if (oldClass !== newClass) {
        changes.push({ day, slot, oldClass, newClass });
      }
    });
  });

  return changes;
}

const SEMESTER_NAMES = {
  odd: "odd sem",
  even: "even sem",
  summer: "summer",
  term3: "term 3",
};

export default function NeoHome() {
  const navigate = useNavigate();
  const [timetable, setTimetable] = useState(
    JSON.parse(localStorage.getItem("timetable") || "{}")
  );
  const [current, setCurrent] = useState(null);
  const [next, setNext] = useState(null);
  const [semester, setSemester] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [showChangesPopup, setShowChangesPopup] = useState(false);
  const [resyncChanges, setResyncChanges] = useState([]);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [radioEnabled, setRadioEnabled] = useState(
    () => localStorage.getItem("radio_enabled") === "true"
  );
  const previousTimetableRef = useRef(null);

  useEffect(() => {
    const checkRadioEnabled = () => {
      setRadioEnabled(localStorage.getItem("radio_enabled") === "true");
    };
    checkRadioEnabled();
    window.addEventListener("focus", checkRadioEnabled);
    return () => window.removeEventListener("focus", checkRadioEnabled);
  }, []);

  useEffect(() => {
    const { current: cur, next: nxt } = findCurrentAndNextClass(timetable);
    setCurrent(cur);
    setNext(nxt);

    const storedSemester = localStorage.getItem("semester") || "odd";
    const validSemesters = new Set(["odd", "even", "summer", "term3"]);
    setSemester(validSemesters.has(storedSemester) ? storedSemester : "odd");
    setAcademicYear(localStorage.getItem("academicYear") || "2024-25");
  }, [timetable]);

  useEffect(() => {
    trackEvent("home_page_viewed", {
      has_timetable: Object.keys(timetable).length > 0,
      has_current_class: !!current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-sync timetable once per day
  useEffect(() => {
    const lastSync = localStorage.getItem("timetable_last_sync");
    const today = new Date().toDateString();
    if (lastSync === today) return; // already synced today

    let cancelled = false;
    const autoSync = async () => {
      try {
        setAutoSyncing(true);
        const oldSnapshot = timetable || {};
        const newTimetable = await syncTimetable();
        if (!cancelled) {
          const changes = getTimetableChanges(oldSnapshot, newTimetable);
          setTimetable(newTimetable);
          localStorage.setItem("timetable_last_sync", today);
          if (changes.length > 0) {
            setResyncChanges(changes);
            setShowChangesPopup(true);
          }
          trackEvent("timetable_synced", {
            sync_location: "home_page",
            day_count: Object.keys(newTimetable).length,
            sync_method: "auto_daily",
          });
        }
      } catch {
        // Silent fail — user can manually resync if needed
      } finally {
        if (!cancelled) setAutoSyncing(false);
      }
    };
    autoSync();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    previousTimetableRef.current = timetable;
    try {
      const newTimetable = await syncTimetable();
      const today = new Date().toDateString();
      localStorage.setItem("timetable_last_sync", today);

      const dayCount = Object.keys(newTimetable).length;
      trackEvent("timetable_synced", {
        sync_location: "home_page",
        day_count: dayCount,
        sync_method: "direct",
      });

      const oldSnapshot = previousTimetableRef.current || timetable || {};
      const changes = getTimetableChanges(oldSnapshot, newTimetable);

      setTimetable(newTimetable);
      if (changes.length > 0) {
        setResyncChanges(changes);
        setShowChangesPopup(true);
      }
      previousTimetableRef.current = null;
    } catch (error) {
      setToast({
        show: true,
        message: error.message || "Failed to sync timetable.",
        type: "error",
      });
      throw error;
    }
  };

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <NeoShell onRefresh={handleRefresh} refreshMode="direct" autoSyncing={autoSyncing}>
      <div>
      <div className="np-pagehead">
        <span className="np-eyebrow">today · {todayLabel}</span>
        <div className="np-pagehead__row">
          <h1 className="np-pagehead__title">your day<i>.</i></h1>
          <span className="np-chip">
            {SEMESTER_NAMES[semester] || semester} <small>{academicYear}</small>
          </span>
        </div>
      </div>

      {/* happening now */}
      <section className={`np-now${current ? "" : " np-now--idle"}`}>
        <div className="np-now__label">
          <span className="np-now__pulse" />
          <span>{current ? "happening now" : "nothing right now"}</span>
          {current && (
            <ClassTimerReadout
              startTimeMs={current.startTimeMs}
              endTimeMs={current.endTimeMs}
            />
          )}
        </div>
        <div className="np-now__class">
          {current ? current.name : "no ongoing class. enjoy the break."}
        </div>
        {current && <div className="np-now__time">{current.time}</div>}
        {current && (
          <ClassProgressBar
            startTimeMs={current.startTimeMs}
            endTimeMs={current.endTimeMs}
          />
        )}
      </section>

      {/* up next */}
      <section className="np-next">
        <span className="np-next__label">up<br />next</span>
        <div className="np-next__body">
          <div className="np-next__class">
            {next ? next.name : "No more classes today"}
          </div>
          {next && <div className="np-next__time">{next.time}</div>}
        </div>
      </section>

      </div>

      {/* synchronized campus radio (toggleable in profile) */}
      {radioEnabled && (
        <CampusRadio />
      )}

      {/* announcement banner (always visible even if games are disabled) */}
      <AnnouncementBanner />

      {/* minimal portfolio link */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', paddingRight: '8px' }}>
        <a
          href="https://dhanushkotturu.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "var(--np-font-ui, sans-serif)",
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "lowercase",
            color: "var(--np-muted)",
            textDecoration: "none",
            opacity: 0.5,
            transition: "opacity 0.2s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
          onMouseLeave={(e) => e.currentTarget.style.opacity = 0.5}
        >
          portfolio<span style={{ color: 'var(--np-pink)' }}>.</span>
        </a>
      </div>

      {/* timetable changes after resync */}
      <NeoModal
        open={showChangesPopup}
        title="timetable changes found"
        onClose={() => {
          setShowChangesPopup(false);
          setResyncChanges([]);
        }}
      >
        <p className="np-note" style={{ marginBottom: 14 }}>
          These slots changed after the resync:
        </p>
        <div style={{ maxHeight: 280, overflowY: "auto" }}>
          {resyncChanges.map((change, index) => (
            <div key={`${change.day}-${change.slot}-${index}`} className="np-panel" style={{ marginBottom: 10 }}>
              <div className="np-panel__label" style={{ marginBottom: 8 }}>
                {change.day} · slot {change.slot}
              </div>
              <div className="np-note">
                <div><b style={{ color: "var(--np-pink)" }}>old</b> — {change.oldClass}</div>
                <div style={{ marginTop: 4 }}><b style={{ color: "var(--np-acid)" }}>new</b> — {change.newClass}</div>
              </div>
            </div>
          ))}
        </div>
      </NeoModal>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
    </NeoShell>
  );
}
