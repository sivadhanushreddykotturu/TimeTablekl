import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { syncTimetable } from "../../utils/syncTimetable.js";
import Toast from "../components/Toast";
import { getTodaySubjects, replaceCourseCodeWithCustomName } from "../utils/subjectMapper";
import FeedbackButton from '../components/FeedbackButton';
import { trackEvent } from "../utils/analytics";
import { getSlotTimes, getMaxSlots } from "../utils/slotTimes";

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
  let currentClass = "No ongoing class";
  let nextClass = "No upcoming class";

  // Convert slots to entries and filter valid slots
  const entries = Object.entries(slots)
    .filter(([slot]) => parseInt(slot) <= maxSlots)
    .map(([slot, value]) => [parseInt(slot), value]);

  // Find the current class block
  let currentBlock = null;
  let nextBlock = null;

  // Merge consecutive slots like in TimetableView
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

  // Find current class (only if we're in a valid slot)
  if (currentSlot) {
    for (const block of merged) {
      if (currentSlot >= block.startSlot && currentSlot <= block.endSlot) {
        currentBlock = block;
        break;
      }
    }
  }

  // Find next class
  if (currentSlot) {
    // If we're in an active slot, find the next class after current slot
    for (const block of merged) {
      if (block.startSlot > currentSlot) {
        nextBlock = block;
        break;
      }
    }
  } else {
    // If we're not in an active slot (break time), find the next upcoming class
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

  // Set current class
  if (currentBlock) {
    const mappedContent = replaceCourseCodeWithCustomName(currentBlock.content);
    currentClass = `${mappedContent} (${slotTimes[currentBlock.startSlot].start} - ${slotTimes[currentBlock.endSlot].end})`;
  }

  // Set next class
  if (nextBlock) {
    const mappedContent = replaceCourseCodeWithCustomName(nextBlock.content);
    nextClass = `${mappedContent} (${slotTimes[nextBlock.startSlot].start} - ${slotTimes[nextBlock.endSlot].end})`;
  }

  return { currentClass, nextClass };
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


export default function Home() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState("Loading...");
  const [next, setNext] = useState("Loading...");
  const [timetable, setTimetable] = useState(
    JSON.parse(localStorage.getItem("timetable") || "{}")
  );
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [semester, setSemester] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [todaySubjects, setTodaySubjects] = useState([]);
  const [showChangesPopup, setShowChangesPopup] = useState(false);
  const [resyncChanges, setResyncChanges] = useState([]);
  const previousTimetableRef = useRef(null);

  useEffect(() => {
    const { currentClass, nextClass } = findCurrentAndNextClass(timetable);
    setCurrent(currentClass);
    setNext(nextClass);

    // Get stored semester and academic year
    const storedSemester = localStorage.getItem("semester") || "odd";
    const validSemesters = new Set(["odd", "even", "summer", "term3"]);
    const cleanedSemester = validSemesters.has(storedSemester) ? storedSemester : "odd";
    const storedAcademicYear = localStorage.getItem("academicYear") || "2024-25";
    setSemester(cleanedSemester);
    setAcademicYear(storedAcademicYear);

    // Get today's subjects
    setTodaySubjects(getTodaySubjects());
  }, [timetable]);

  // Track home page view
  useEffect(() => {
    trackEvent('home_page_viewed', {
      has_timetable: Object.keys(timetable).length > 0,
      today_subjects_count: todaySubjects.length,
      has_current_class: current !== "Loading..." && current !== "No ongoing class"
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Track only once on mount

  const handleRefresh = async () => {
    previousTimetableRef.current = timetable;
    try {
      const newTimetable = await syncTimetable();
      handleCaptchaSuccess(newTimetable);
    } catch (error) {
      setToast({
        show: true,
        message: error.message || "Failed to sync timetable.",
        type: "error"
      });
      throw error; // Re-throw to inform Header's isSyncing state
    }
  };

  const handleCaptchaSuccess = (newTimetable) => {
    // Track timetable sync
    const dayCount = Object.keys(newTimetable).length;
    trackEvent('timetable_synced', {
      sync_location: 'home_page',
      day_count: dayCount,
      sync_method: 'direct'
    });

    const oldTimetableSnapshot = previousTimetableRef.current || timetable || {};
    const changes = getTimetableChanges(oldTimetableSnapshot, newTimetable);

    setTimetable(newTimetable);
    setTodaySubjects(getTodaySubjects());
    if (changes.length > 0) {
      setResyncChanges(changes);
      setShowChangesPopup(true);
    } else {
      setResyncChanges([]);
      setShowChangesPopup(false);
    }

    previousTimetableRef.current = null;
  };

  const closeToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };

  const getSemesterDisplayName = (sem) => {
    switch (sem) {
      case 'odd': return 'Odd Semester';
      case 'even': return 'Even Semester';
      case 'summer': return 'Summer Semester';
      case 'term3': return 'Term3';
      default: return sem;
    }
  };

  return (
    <>
      <Header onRefresh={handleRefresh} />

      <div className="container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Your Timetable</h1>
            <p className="page-subtitle">
              {getSemesterDisplayName(semester)} • {academicYear}
            </p>
          </div>
        </div>

        <div className="class-card">
          <h2>Current Class</h2>
          <div className="class-card-content">
            {current}
          </div>
        </div>

        <div className="class-card">
          <h2>Next Class</h2>
          <div className="class-card-content">
            {next}
          </div>
        </div>

        {todaySubjects.length > 0 && (
          <div className="class-card">
            <h2>Today's Subjects</h2>
            <div className="today-subjects">
              {todaySubjects.map((subject, index) => (
                <div key={index} className="subject-item">
                  <span className="subject-display-name">{subject.displayName}</span>
                  {subject.displayName !== subject.code && (
                    <span className="subject-original-code">({subject.code})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="button-container">
          <button
            onClick={() => navigate("/timetable")}
            className="primary full-width-mobile"
          >
            View Full Timetable
          </button>

          <button
            onClick={() => navigate("/attendance")}
            className="secondary full-width-mobile"
            style={{ marginTop: "20px" }}
          >
            Attendance
          </button>

          <button
            onClick={() => navigate("/grades")}
            className="secondary full-width-mobile"
            style={{ marginTop: "20px" }}
          >
            CGPA &amp; SGPA
          </button>

          <button
            onClick={() => navigate("/maddys")}
            className="secondary full-width-mobile"
            style={{ marginTop: "20px" }}
          >
            Where's doc? 👥
          </button>

          <button
            onClick={() => navigate("/subjects")}
            className="secondary full-width-mobile"
            style={{ marginTop: "20px" }}
          >
            Manage Subject Names
          </button>

          <button
            onClick={() => {
              localStorage.setItem("examMode", "true");
              navigate("/exam");
            }}
            className="secondary full-width-mobile"
            style={{ marginTop: "20px" }}
          >
            Exam Mode
          </button>
        </div>

        <FeedbackButton />
      </div>



      {showChangesPopup && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Timetable Changes Found</h2>
            </div>
            <div className="modal-body">
              <p className="mb-16">Compared with your previous timetable snapshot.</p>
              <p className="mb-16">These class slots changed after ReSync:</p>
              <div style={{ maxHeight: "260px", overflowY: "auto", marginBottom: "16px" }}>
                {resyncChanges.map((change, index) => (
                  <div key={`${change.day}-${change.slot}-${index}`} className="class-card" style={{ marginBottom: "10px" }}>
                    <div style={{ fontWeight: 600, marginBottom: "6px" }}>
                      {change.day} - Slot {change.slot}
                    </div>
                    <div style={{ fontSize: "14px" }}>
                      <div><strong>Old:</strong> {change.oldClass}</div>
                      <div><strong>New:</strong> {change.newClass}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="modal-actions">
                <button
                  className="primary"
                  onClick={() => {
                    setShowChangesPopup(false);
                    setResyncChanges([]);
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={closeToast}
      />
    </>
  );
}
