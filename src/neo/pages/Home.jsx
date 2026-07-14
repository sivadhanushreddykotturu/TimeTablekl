import React, { useEffect, useRef, useState } from "react";
import NeoShell, { NeoModal } from "../Shell.jsx";
import Toast from "../../components/Toast.jsx";
import { syncTimetable } from "../../../utils/syncTimetable.js";
import { getTodaySubjects, replaceCourseCodeWithCustomName } from "../../utils/subjectMapper";
import { trackEvent } from "../../utils/analytics";
import { getSlotTimes, getMaxSlots } from "../../utils/slotTimes";

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

  const toInfo = (block) =>
    block
      ? {
          name: replaceCourseCodeWithCustomName(block.content),
          time: `${slotTimes[block.startSlot].start} – ${slotTimes[block.endSlot].end}`,
        }
      : null;

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
  const [timetable, setTimetable] = useState(
    JSON.parse(localStorage.getItem("timetable") || "{}")
  );
  const [current, setCurrent] = useState(null);
  const [next, setNext] = useState(null);
  const [todaySubjects, setTodaySubjects] = useState([]);
  const [semester, setSemester] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [showChangesPopup, setShowChangesPopup] = useState(false);
  const [resyncChanges, setResyncChanges] = useState([]);
  const previousTimetableRef = useRef(null);

  useEffect(() => {
    const { current: cur, next: nxt } = findCurrentAndNextClass(timetable);
    setCurrent(cur);
    setNext(nxt);

    const storedSemester = localStorage.getItem("semester") || "odd";
    const validSemesters = new Set(["odd", "even", "summer", "term3"]);
    setSemester(validSemesters.has(storedSemester) ? storedSemester : "odd");
    setAcademicYear(localStorage.getItem("academicYear") || "2024-25");
    setTodaySubjects(getTodaySubjects());
  }, [timetable]);

  useEffect(() => {
    trackEvent("home_page_viewed", {
      has_timetable: Object.keys(timetable).length > 0,
      today_subjects_count: todaySubjects.length,
      has_current_class: !!current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    previousTimetableRef.current = timetable;
    try {
      const newTimetable = await syncTimetable();
      const dayCount = Object.keys(newTimetable).length;
      trackEvent("timetable_synced", {
        sync_location: "home_page",
        day_count: dayCount,
        sync_method: "direct",
      });

      const oldSnapshot = previousTimetableRef.current || timetable || {};
      const changes = getTimetableChanges(oldSnapshot, newTimetable);

      setTimetable(newTimetable);
      setTodaySubjects(getTodaySubjects());
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
    <NeoShell onRefresh={handleRefresh} refreshMode="sheet">
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
          {current ? "happening now" : "nothing right now"}
        </div>
        <div className="np-now__class">
          {current ? current.name : "no ongoing class. enjoy the break."}
        </div>
        {current && <div className="np-now__time">{current.time}</div>}
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

      {/* today's subjects */}
      {todaySubjects.length > 0 && (
        <section className="np-panel">
          <div className="np-panel__label">today's subjects</div>
          <div className="np-chips">
            {todaySubjects.map((subject, index) => (
              <span key={index} className="np-chip">
                {subject.displayName}
                {subject.displayName !== subject.code && (
                  <small>{subject.code}</small>
                )}
              </span>
            ))}
          </div>
        </section>
      )}

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
