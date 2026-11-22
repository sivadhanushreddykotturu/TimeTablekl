import React, { useEffect, useMemo, useState } from "react";
import { FiShare2, FiGrid } from "react-icons/fi";
import NeoShell, { NeoModal } from "../Shell.jsx";
import TimetableChangesModal from "../components/TimetableChangesModal.jsx";
import { ClassProgressBar } from "../components/ClassTimer.jsx";
import Toast from "../../components/Toast.jsx";
import GuestAuthModal from "../../components/GuestAuthModal.jsx";

import { getCredentials } from "../../../utils/storage.js";
import { trackEvent } from "../../utils/analytics";
import { getSlotTimes, getMaxSlots, formatTimeStr } from "../../utils/slotTimes";
import { useNowTick } from "../../hooks/useNowTick";
import { useTimetable } from "../../hooks/useTimetable";
import { shareTimetableImage } from "../utils/exportTimetable";
import {
  DAYS,
  DAY_ORDER,
  DAY_NAMES,
  getDayBlocks,
  parseClass,
  getDayState,
  getInitialDay,
  dateInThisWeek,
  subjectHue,
  formatMeta,
  formatSlots,
  formatDuration,
  getTimeFormat,
} from "../../utils/schedule";

const MIN_GAP_SHOWN = 20; // minutes — shorter gaps are just the walk between rooms

export default function NeoTimetable() {
  const { timetable, autoSyncing, changes, clearChanges, refresh, reload } = useTimetable("timetable_page");
  const nowTick = useNowTick();
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [exporting, setExporting] = useState(false);
  const [showTableView, setShowTableView] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(() => !getCredentials());
  const [activeDay, setActiveDay] = useState(() => getInitialDay(timetable));

  const format = getTimeFormat();
  const days = DAY_ORDER.filter((day) => timetable[day]);
  const todayName = DAYS[new Date().getDay()];
  const isToday = activeDay === todayName;

  // laptop keys: arrows step through the days, T jumps back to today
  useEffect(() => {
    const onDay = (event) => {
      if (event.detail === "today") {
        if (days.includes(todayName)) setActiveDay(todayName);
        return;
      }
      const at = days.indexOf(activeDay);
      const next = event.detail === "next" ? at + 1 : at - 1;
      if (days[next]) setActiveDay(days[next]);
    };
    window.addEventListener("kbd_day", onDay);
    return () => window.removeEventListener("kbd_day", onDay);
  }, [days, activeDay, todayName]);

  useEffect(() => {
    const dayCount = Object.keys(timetable).length;
    trackEvent("timetable_page_viewed", {
      has_timetable: dayCount > 0,
      day_count: dayCount,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Today's blocks carry a live status; other days are plain.
  const blocks = useMemo(
    () => (isToday ? getDayState(timetable).blocks : getDayBlocks(timetable, activeDay)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timetable, activeDay, isToday, nowTick]
  );

  const refreshTimetable = async () => {
    try {
      await refresh();
    } catch (error) {
      setToast({
        show: true,
        message: error.message || "Failed to sync timetable.",
        type: "error",
      });
      throw error;
    }
  };

  const exportAsImage = async () => {
    setExporting(true);
    try {
      await shareTimetableImage(timetable);
    } catch (error) {
      setToast({ show: true, message: error.message || "Export failed. Please try again.", type: "error" });
    } finally {
      setExporting(false);
    }
  };

  const slotTimes = getSlotTimes();
  const maxSlots = getMaxSlots();

  return (
    <NeoShell onRefresh={refreshTimetable} autoSyncing={autoSyncing}>
      <div className="np-pagehead">
        <div className="np-pagehead__row">
          <h1 className="np-pagehead__title">Week</h1>
          {days.length > 0 && (
            <div className="np-pagehead__actions">
              <button
                className="np-iconbtn"
                onClick={() => setShowTableView(true)}
                aria-label="Week grid"
                title="Week grid"
              >
                <FiGrid size={17} />
              </button>
              <button
                className="np-iconbtn"
                onClick={exportAsImage}
                disabled={exporting}
                aria-label="Share timetable"
                title="Share timetable"
              >
                <FiShare2 size={17} />
              </button>
            </div>
          )}
        </div>
      </div>

      {days.length === 0 ? (
        !getCredentials() ? (
          <div className="np-empty">
            <h2 className="np-empty__title">See your week</h2>
            <p className="np-empty__text">Log in with your KL ERP account to load your timetable.</p>
            <button type="button" className="np-btn" onClick={() => setShowGuestModal(true)}>Log in</button>
          </div>
        ) : (
          <div className="np-empty">
            <h2 className="np-empty__title">No timetable loaded</h2>
            <p className="np-empty__text">Sign in again or hit sync to pull it from ERP.</p>
          </div>
        )
      ) : (
        <>
          <div className="np-days" role="tablist" aria-label="Day">
            {days.map((day) => (
              <button
                key={day}
                role="tab"
                aria-selected={activeDay === day}
                aria-label={DAY_NAMES[day]}
                className={`np-day${activeDay === day ? " is-active" : ""}${day === todayName ? " is-today" : ""}`}
                onClick={() => setActiveDay(day)}
              >
                {day}
                <b>{dateInThisWeek(day).getDate()}</b>
              </button>
            ))}
          </div>

          {blocks.length === 0 ? (
            <div className="np-empty">
              <h2 className="np-empty__title">Nothing on {DAY_NAMES[activeDay]}</h2>
              <p className="np-empty__text">A full day off. Use it well.</p>
            </div>
          ) : (
            <>
              <p className="np-daysum">
                <b>{isToday ? "Today" : DAY_NAMES[activeDay]}</b> · {blocks.length}{" "}
                {blocks.length === 1 ? "class" : "classes"} ·{" "}
                {formatTimeStr(blocks[0].start, format)} – {formatTimeStr(blocks[blocks.length - 1].end, format)}
              </p>

              <div className="np-timeline">
                {blocks.map((block, index) => {
                  const gap = index > 0 ? block.startMin - blocks[index - 1].endMin : 0;
                  const meta = [formatMeta(block, { withSection: true }), formatSlots(block)]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <React.Fragment key={block.startSlot}>
                      {gap >= MIN_GAP_SHOWN && (
                        <div className="np-gap">{formatDuration(gap)} free</div>
                      )}
                      <div
                        className={`np-slot${block.status === "live" ? " is-live" : ""}${block.status === "done" ? " is-done" : ""}`}
                        style={{ "--hue": subjectHue(block.code) }}
                      >
                        <div className="np-slot__time">
                          {formatTimeStr(block.start, format)}
                          <small>{formatTimeStr(block.end, format)}</small>
                        </div>
                        <span className="np-slot__bar" aria-hidden="true" />
                        <div className="np-slot__body">
                          <div className="np-slot__name">{block.title}</div>
                          <div className="np-slot__meta">{meta}</div>
                        </div>
                        {block.status === "live" && (
                          <>
                            <span className="np-slot__live">Now</span>
                            <ClassProgressBar startTimeMs={block.startTimeMs} endTimeMs={block.endTimeMs} />
                          </>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* whole week at a glance */}
      <NeoModal open={showTableView} title="Week grid" onClose={() => setShowTableView(false)} wide>
        <div className="np-grid-wrap">
          <table className="np-grid">
            <thead>
              <tr>
                <th>Time</th>
                {days.map((day) => (
                  <th key={day} className={day === todayName ? "is-today" : undefined}>{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxSlots }, (_, idx) => idx + 1).map((slot) => (
                <tr key={slot}>
                  <td className="np-grid__time">
                    {formatTimeStr(slotTimes[slot]?.start, format)}
                    <small>{formatTimeStr(slotTimes[slot]?.end, format)} · Slot {slot}</small>
                  </td>
                  {days.map((day) => {
                    const classInfo = timetable[day]?.[slot.toString()];
                    const isClass = classInfo && classInfo !== "-";
                    const info = isClass ? parseClass(classInfo) : null;
                    return (
                      <td
                        key={day}
                        className={`${isClass ? "is-class" : ""}${day === todayName ? " is-today" : ""}`}
                      >
                        {info ? (
                          <>
                            {info.title}
                            <small>{formatMeta(info)}</small>
                          </>
                        ) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </NeoModal>

      <GuestAuthModal
        isOpen={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        pageType="timetable"
        onSuccess={async () => {
          setShowGuestModal(false);
          reload();
        }}
      />

      <TimetableChangesModal changes={changes} onClose={clearChanges} />

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
    </NeoShell>
  );
}
