import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FiClock, FiCheck, FiX, FiMinus, FiAlertTriangle, FiArrowRight, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { NeoModal } from "../neo/Shell.jsx";
import {
  findClassesInRange,
  calculateAttendanceImpact
} from "../utils/bunkSimulator";
import { extractMainCode, getSubjectName } from "../utils/subjectMapper";

// Helper to format Date object into YYYY-MM-DD local string
function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Preset date ranges
function getPresets() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  // This week (until Saturday)
  const thisWeekEnd = new Date(today);
  const dayOfWeek = today.getDay(); // 0 is Sun, 6 is Sat
  const daysUntilSat = dayOfWeek === 6 ? 0 : (6 - dayOfWeek);
  thisWeekEnd.setDate(today.getDate() + daysUntilSat);

  // Next week (Monday to Saturday)
  const nextMon = new Date(today);
  const daysUntilNextMon = ((8 - dayOfWeek) % 7) || 7;
  nextMon.setDate(today.getDate() + daysUntilNextMon);
  const nextSat = new Date(nextMon);
  nextSat.setDate(nextMon.getDate() + 5);

  // Next 14 days
  const twoWeeks = new Date(today);
  twoWeeks.setDate(today.getDate() + 14);

  return {
    today: { start: toIsoDate(today), end: toIsoDate(today), label: "Today" },
    tomorrow: { start: toIsoDate(tomorrow), end: toIsoDate(tomorrow), label: "Tomorrow" },
    thisWeek: { start: toIsoDate(today), end: toIsoDate(thisWeekEnd), label: "This Week" },
    nextWeek: { start: toIsoDate(nextMon), end: toIsoDate(nextSat), label: "Next Week" },
    next14: { start: toIsoDate(today), end: toIsoDate(twoWeeks), label: "Next 14 Days" },
  };
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

// Minimal month calendar: tap one day, tap another to stretch the range. Dots mark days with this subject's classes.
function RangeCalendar({ start, end, onChange, timetable, course }) {
  const [view, setView] = useState(() => {
    const d = new Date(start || Date.now());
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [picking, setPicking] = useState(false); // true after the first tap, waiting for the end date

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstIso = toIsoDate(new Date(year, month, 1));
  const lastIso = toIsoDate(new Date(year, month + 1, 0));
  const todayIso = toIsoDate(new Date());

  const classDays = useMemo(() => {
    if (!course) return new Set();
    return new Set(
      findClassesInRange(timetable, course.courseCode, course.courseName, firstIso, lastIso).map(c => c.date)
    );
  }, [timetable, course, firstIso, lastIso]);

  // Monday-first grid
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toIsoDate(new Date(year, month, d)));

  const pick = (iso) => {
    if (!picking || iso < start) {
      onChange(iso, iso);
      setPicking(true);
    } else {
      onChange(start, iso);
      setPicking(false);
    }
  };

  const monthLabel = view.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="bc-cal">
      <div className="bc-cal__head">
        <button type="button" aria-label="Previous month" onClick={() => setView(new Date(year, month - 1, 1))}>
          <FiChevronLeft size={18} />
        </button>
        <span>{monthLabel}</span>
        <button type="button" aria-label="Next month" onClick={() => setView(new Date(year, month + 1, 1))}>
          <FiChevronRight size={18} />
        </button>
      </div>
      <div className="bc-cal__grid">
        {WEEKDAYS.map((w, i) => <div key={i} className="bc-cal__wd">{w}</div>)}
        {cells.map((iso, i) => {
          if (!iso) return <div key={`e${i}`} />;
          const isStart = iso === start;
          const isEnd = iso === end;
          const inRange = iso > start && iso < end;
          return (
            <button
              type="button"
              key={iso}
              onClick={() => pick(iso)}
              className={[
                "bc-cal__day",
                isStart || isEnd ? "is-edge" : "",
                inRange ? "is-range" : "",
                iso === todayIso ? "is-today" : "",
                classDays.has(iso) ? "has-class" : ""
              ].join(" ")}
            >
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
      {picking && <div className="bc-cal__hint">Tap the last day, or the same day again for one day</div>}
    </div>
  );
}

export default function BunkSimulatorModal({
  isOpen,
  onClose,
  attendanceData = [],
  initialCourseCode = "",
  includeTcbr = true,
  targetPercentage = 85,
  timetable: propTimetable
}) {
  // Read user's custom safe percentage from localStorage if not provided
  const userSafePercentage = useMemo(() => {
    if (Number.isFinite(targetPercentage) && targetPercentage > 0) return targetPercentage;
    try {
      const stored = parseFloat(localStorage.getItem("attendanceTargetPercentage"));
      return Number.isFinite(stored) ? stored : 85;
    } catch (_) {
      return 85;
    }
  }, [targetPercentage]);

  // Read timetable from props or localStorage
  const timetable = useMemo(() => {
    if (propTimetable && Object.keys(propTimetable).length > 0) return propTimetable;
    try {
      return JSON.parse(localStorage.getItem("timetable") || "{}");
    } catch (_) {
      return {};
    }
  }, [propTimetable]);

  const hasTimetable = useMemo(() => Object.keys(timetable).length > 0, [timetable]);

  // Grouped courses list for the subject picker
  const courses = useMemo(() => {
    if (!attendanceData || attendanceData.length === 0) return [];
    const map = new Map();

    attendanceData.forEach((item) => {
      const code = item.course_code ?? item.Coursecode ?? "";
      const name = item.course_name ?? item.Coursedesc ?? "";
      if (!code) return;

      if (!map.has(code)) {
        const mainCode = extractMainCode(code);
        const shortName = (getSubjectName(mainCode) || "").replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "") || mainCode || code;

        map.set(code, {
          courseCode: code,
          courseName: name,
          shortName,
          sections: []
        });
      }

      map.get(code).sections.push({
        ltps: item.type ?? item.Ltps ?? "",
        section: item.section ?? item.Section ?? "",
        attended: item.attended ?? item["Total Attended"] ?? "0",
        conducted: item.conducted ?? item["Total Conducted"] ?? "0",
        tcbr: item.tcbr ?? item.Tcbr ?? "0"
      });
    });

    // Calculate base attendance percentage per course for the selector cards
    return Array.from(map.values()).map(course => {
      const impact = calculateAttendanceImpact(course, [], includeTcbr, userSafePercentage);
      return {
        ...course,
        currentPct: impact.currentPercentage
      };
    });
  }, [attendanceData, includeTcbr, userSafePercentage]);

  // Selected course code
  const [selectedCourseCode, setSelectedCourseCode] = useState("");

  // Presets
  const presets = useMemo(() => getPresets(), []);
  const [activePreset, setActivePreset] = useState("thisWeek");

  // Date Range state
  const [startDate, setStartDate] = useState(presets.thisWeek.start);
  const [endDate, setEndDate] = useState(presets.thisWeek.end);

  // Synchronize initial course code when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (initialCourseCode && courses.some(c => c.courseCode === initialCourseCode)) {
      setSelectedCourseCode(initialCourseCode);
    } else if (courses.length > 0 && !selectedCourseCode) {
      setSelectedCourseCode(courses[0].courseCode);
    }
  }, [isOpen, initialCourseCode, courses, selectedCourseCode]);

  // Selected course object
  const currentCourse = useMemo(() => {
    return courses.find(c => c.courseCode === selectedCourseCode) || courses[0] || null;
  }, [courses, selectedCourseCode]);

  // Scheduled classes found in timetable
  const [classesList, setClassesList] = useState([]);

  // Classes that have already started: normally counted by the ERP, but can be added back by hand
  const [startedPool, setStartedPool] = useState([]);
  const [showPool, setShowPool] = useState(false);

  // Load classes whenever subject or dates change
  useEffect(() => {
    setShowPool(false);
    if (!currentCourse || !hasTimetable) {
      setClassesList([]);
      setStartedPool([]);
      return;
    }

    const all = findClassesInRange(
      timetable,
      currentCourse.courseCode,
      currentCourse.courseName,
      startDate,
      endDate,
      true
    );

    setUndoSnap(null);
    setClassesList(all.filter(c => !c.started));
    // Only today's classes: earlier days are long since in the ERP
    setStartedPool(all.filter(c => c.started && c.date === toIsoDate(new Date())));
  }, [currentCourse, timetable, startDate, endDate, hasTimetable]);

  // Snapshot for undoing the last bulk action
  const [undoSnap, setUndoSnap] = useState(null);
  const [shareMsg, setShareMsg] = useState("");

  const buzz = () => {
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (_) {}
  };

  // Tap a class to flip it between present (default) and absent
  const toggleClass = useCallback((classId) => {
    buzz();
    setUndoSnap(null);
    setClassesList(prev =>
      prev.map(c =>
        c.id === classId ? { ...c, status: c.status === "attend" ? "bunk" : "attend" } : c
      )
    );
  }, []);

  // Mark a class as "not held" (holiday / cancelled) so it isn't counted at all
  const toggleOff = useCallback((classId) => {
    buzz();
    setUndoSnap(null);
    setClassesList(prev =>
      prev.map(c =>
        c.id === classId ? { ...c, status: c.status === "off" ? "attend" : "off" } : c
      )
    );
  }, []);

  const applyBatch = (mapper) => {
    buzz();
    setUndoSnap(classesList);
    setClassesList(classesList.map(mapper));
  };

  const addFromPool = (item) => {
    buzz();
    setStartedPool(prev => prev.filter(c => c.id !== item.id));
    setClassesList(prev =>
      [...prev, { ...item, status: "attend" }].sort((x, y) =>
        x.date === y.date ? x.startSlot - y.startSlot : x.date < y.date ? -1 : 1
      )
    );
  };

  const handleBunkAll = () => applyBatch(c => (c.status === "off" ? c : { ...c, status: "bunk" }));
  const handleResetAll = () => applyBatch(c => ({ ...c, status: "attend" }));

  const handleUndo = () => {
    if (!undoSnap) return;
    buzz();
    setClassesList(undoSnap);
    setUndoSnap(null);
  };

  const absentCount = useMemo(() => classesList.filter(c => c.status === "bunk").length, [classesList]);
  const offCount = useMemo(() => classesList.filter(c => c.status === "off").length, [classesList]);

  // Preset click handler
  const handleSelectPreset = (key) => {
    setActivePreset(key);
    if (presets[key]) {
      setStartDate(presets[key].start);
      setEndDate(presets[key].end);
    }
  };

  // Live Attendance Impact Calculation with LTPS weights
  const impact = useMemo(() => {
    return calculateAttendanceImpact(currentCourse, classesList, includeTcbr, userSafePercentage);
  }, [currentCourse, classesList, includeTcbr, userSafePercentage]);

  // For an empty range, find the next day this subject actually has a class
  const nextClass = useMemo(() => {
    if (!currentCourse || !hasTimetable || classesList.length > 0) return null;
    const from = new Date();
    const to = new Date();
    to.setDate(from.getDate() + 28);
    return findClassesInRange(
      timetable, currentCourse.courseCode, currentCourse.courseName, toIsoDate(from), toIsoDate(to)
    )[0] || null;
  }, [currentCourse, hasTimetable, classesList.length, timetable]);

  const handleJumpToNext = () => {
    if (!nextClass) return;
    setActivePreset("custom");
    setStartDate(nextClass.date);
    setEndDate(nextClass.date);
  };

  const handleShare = async () => {
    const skipped = classesList.filter(c => c.status === "bunk");
    const name = currentCourse?.shortName || currentCourse?.courseCode || "";
    const plan = skipped.length
      ? `skipping ${skipped.length} of ${classesList.length} classes (${skipped.map(c => c.dateDisplay).join(", ")})`
      : `attending all ${classesList.length} classes`;
    const text = `${name}: ${impact.currentPercentage}% → ${impact.simulatedPercentage}% by ${plan}. Plan yours: ${window.location.origin}`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShareMsg("Copied");
      setTimeout(() => setShareMsg(""), 1800);
    } catch (_) {}
  };

  if (!isOpen) return null;

  const totalHours = classesList.reduce((acc, c) => acc + c.hours, 0);
  const quickKeys = ["today", "tomorrow", "thisWeek"];
  const state = impact.isSafe ? "is-safe" : "is-risk";
  // Opened from a subject's own button: that subject is already chosen, so skip the picker
  const locked = !!initialCourseCode && courses.some(c => c.courseCode === initialCourseCode);

  let hint = startedPool.length > 0
    ? "No more classes left today"
    : "Pick a subject and a date to see its classes.";
  if (classesList.length > 0) {
    const held = classesList.length - offCount;
    const offNote = offCount > 0 ? ` · ${offCount} not held` : "";
    hint = held === 0
      ? `No classes counted${offNote}`
      : absentCount === 0
        ? `Attending all ${held} classes${offNote}`
        : `${absentCount} of ${held} skipped · ${impact.bunkedHours}h${offNote}`;
  }

  return (
    <NeoModal open={isOpen} title="bunk calculator" onClose={onClose} wide>
      <div className="bc">

        {locked && currentCourse && <div className="bc-subject">{currentCourse.courseName}</div>}

        {/* Result */}
        <div className={`bc-result ${state}`}>
          <div className="bc-result__nums">
            <span className="bc-now">{impact.currentPercentage}%</span>
            <FiArrowRight size={16} className="bc-arrow" />
            <span className="bc-after">{impact.simulatedPercentage}%</span>
            {impact.hasChanges && impact.delta !== 0 && (
              <span className="bc-delta">{impact.delta > 0 ? `+${impact.delta}` : impact.delta}</span>
            )}
          </div>
          <div className="bc-result__meta">
            <span>{hint}</span>
            <span className="bc-status">
              {impact.isSafe ? "Above" : "Below"} {userSafePercentage}%
            </span>
          </div>
        </div>

        {/* Subject */}
        {!locked && <div className="bc-block">
          <div className="bc-label">Subject</div>
          <div className="bc-chips">
            {courses.map((c) => (
              <button
                key={c.courseCode}
                type="button"
                title={c.courseName}
                onClick={() => setSelectedCourseCode(c.courseCode)}
                className={`bc-chip ${c.courseCode === selectedCourseCode ? "is-on" : ""}`}
              >
                <span>{c.shortName || c.courseCode}</span>
                <small className={c.currentPct >= userSafePercentage ? "is-good" : "is-warn"}>{c.currentPct}%</small>
              </button>
            ))}
          </div>
          {currentCourse && <div className="bc-sub">{currentCourse.courseName}</div>}
        </div>}

        {/* When */}
        <div className="bc-block">
          <div className="bc-label">When</div>
          <div className="bc-seg">
            {quickKeys.map((key) => (
              <button
                key={key}
                type="button"
                className={activePreset === key ? "is-on" : ""}
                onClick={() => handleSelectPreset(key)}
              >
                {presets[key].label}
              </button>
            ))}
            <button
              type="button"
              className={activePreset === "custom" ? "is-on" : ""}
              onClick={() => setActivePreset("custom")}
            >
              Custom
            </button>
          </div>
          {activePreset === "custom" && (
            <RangeCalendar
              start={startDate}
              end={endDate}
              timetable={timetable}
              course={currentCourse}
              onChange={(st, en) => { setActivePreset("custom"); setStartDate(st); setEndDate(en); }}
            />
          )}
        </div>

        {/* Classes */}
        <div className="bc-block">
          <div className="bc-label bc-label--row">
            <span>Classes · tap to skip{classesList.length > 0 ? ` (${classesList.length})` : ""}</span>
            {classesList.length > 0 && (
              <span className="bc-links">
                {absentCount < classesList.length - offCount && (
                  <button type="button" onClick={handleBunkAll}>Skip all</button>
                )}
                {absentCount > 0 && (
                  <button type="button" onClick={handleResetAll}>Reset</button>
                )}
              </span>
            )}
          </div>

          {classesList.length > 0 && (
            <div className="bc-actions">
              {undoSnap && <button type="button" onClick={handleUndo}>Undo</button>}
              <button type="button" onClick={handleShare}>{shareMsg || "Share plan"}</button>
            </div>
          )}

          {!hasTimetable ? (
            <div className="bc-empty">
              <FiAlertTriangle size={18} />
              <p>No timetable found. Sync it on the Home page first.</p>
            </div>
          ) : classesList.length === 0 ? (
            <div className="bc-empty">
              <FiClock size={18} />
              <p>
                {startedPool.length > 0
                  ? "No more classes today."
                  : `No ${currentCourse?.shortName || "classes"} classes in this range.`}
              </p>
              {nextClass ? (
                <button type="button" onClick={handleJumpToNext}>Jump to next class · {nextClass.dateDisplay}</button>
              ) : (
                activePreset !== "thisWeek" && (
                  <button type="button" onClick={() => handleSelectPreset("thisWeek")}>Try this week</button>
                )
              )}
            </div>
          ) : (
            <div className="bc-list">
              {classesList.map((item) => {
                const absent = item.status === "bunk";
                const off = item.status === "off";
                return (
                  <div key={item.id} className={`bc-row ${off ? "is-off" : absent ? "is-absent" : "is-present"}`}>
                    <button
                      type="button"
                      className="bc-row__main"
                      onClick={() => toggleClass(item.id)}
                      aria-pressed={absent}
                      disabled={off}
                    >
                      <span className="bc-row__mark">
                        {off ? <FiMinus size={13} /> : absent ? <FiX size={13} /> : <FiCheck size={13} />}
                      </span>
                      <span className="bc-row__text">
                        <b>{item.dateDisplay}</b>
                        <small>{off ? "No class held · not counted" : `${item.time} · ${item.componentLabel} · ${item.hours}h`}</small>
                      </span>
                    </button>
                    <button type="button" className="bc-row__off" onClick={() => toggleOff(item.id)}>
                      {off ? "Count it" : "No class"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {startedPool.length > 0 && (
            <div className="bc-pool">
              <button type="button" className="bc-pool__toggle" onClick={() => setShowPool(v => !v)}>
                {showPool ? "Hide" : "Attendance not posted yet? Add today's class"}
              </button>
              {showPool && (
                <div className="bc-pool__list">
                  {startedPool.map(item => (
                    <div key={item.id} className="bc-pool__row">
                      <span>
                        <b>{item.dateDisplay}</b>
                        <small>{item.time} · {item.componentLabel} · {item.hours}h</small>
                      </span>
                      <button type="button" onClick={() => addFromPool(item)}>Add</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </NeoModal>
  );
}
