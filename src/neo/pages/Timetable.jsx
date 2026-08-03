import React, { useState, useEffect, useCallback } from "react";
import { FiShare2, FiGrid } from "react-icons/fi";
import NeoShell, { NeoModal } from "../Shell.jsx";
import Toast from "../../components/Toast.jsx";
import { syncTimetable } from "../../../utils/syncTimetable.js";
import { replaceCourseCodeWithCustomName } from "../../utils/subjectMapper";
import { trackEvent } from "../../utils/analytics";
import { getSlotTimes, getMaxSlots, formatTimeStr } from "../../utils/slotTimes";

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function mergeDaySlots(slots, maxSlots) {
  const entries = Object.entries(slots || {})
    .filter(([slot]) => parseInt(slot) <= maxSlots)
    .map(([slot, value]) => [parseInt(slot), value]);

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

  return merged;
}

function getInitialActiveDay(timetable, maxSlots) {
  const daysWithData = DAY_ORDER.filter((day) => timetable[day]);
  if (daysWithData.length === 0) return "Mon";

  const todayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];

  const hasClassesOnDay = (d) => {
    if (!timetable[d]) return false;
    return mergeDaySlots(timetable[d], maxSlots).length > 0;
  };

  // 1. If today has classes, show today
  if (hasClassesOnDay(todayName)) {
    return todayName;
  }

  // 2. Otherwise find next available day in week order that has classes
  const todayIndex = DAY_ORDER.indexOf(todayName);
  const start = todayIndex >= 0 ? todayIndex : 0;
  for (let offset = 1; offset <= 7; offset++) {
    const candidateDay = DAY_ORDER[(start + offset) % 7];
    if (hasClassesOnDay(candidateDay)) {
      return candidateDay;
    }
  }

  // 3. Fallback to first available day in timetable
  return daysWithData[0] || "Mon";
}

export default function NeoTimetable() {
  const [timetable, setTimetable] = useState(
    JSON.parse(localStorage.getItem("timetable") || "{}")
  );
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [exporting, setExporting] = useState(false);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [showTableView, setShowTableView] = useState(false);

  const slotTimes = getSlotTimes();
  const maxSlots = getMaxSlots();

  const days = DAY_ORDER.filter((day) => timetable[day]);
  const todayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
  const [activeDay, setActiveDay] = useState(() =>
    getInitialActiveDay(timetable, maxSlots)
  );

  useEffect(() => {
    const dayCount = Object.keys(timetable).length;
    trackEvent("timetable_page_viewed", {
      has_timetable: dayCount > 0,
      day_count: dayCount,
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
        const newTimetable = await syncTimetable();
        if (!cancelled) {
          setTimetable(newTimetable);
          localStorage.setItem("timetable_last_sync", today);
          trackEvent("timetable_synced", {
            sync_location: "timetable_page",
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

  const refreshTimetable = async () => {
    try {
      const newTimetable = await syncTimetable();
      localStorage.setItem("timetable_last_sync", new Date().toDateString());
      trackEvent("timetable_synced", {
        sync_location: "timetable_page",
        day_count: Object.keys(newTimetable).length,
        sync_method: "direct",
      });
      setTimetable(newTimetable);
    } catch (error) {
      setToast({
        show: true,
        message: error.message || "Failed to sync timetable.",
        type: "error",
      });
      throw error;
    }
  };

  const generateHighQualityCanvas = useCallback(() => {
    if (!timetable || Object.keys(timetable).length === 0) return null;

    const scale = 2;
    const padding = 40;
    const cellPadding = 12;
    const headerHeight = 60;
    const rowHeight = 50;
    const timeColWidth = 100;
    const dayColWidth = 200;

    const orderedDays = DAY_ORDER.filter((day) => timetable[day]);
    if (orderedDays.length === 0) return null;

    const numSlots = getMaxSlots();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const width = timeColWidth + dayColWidth * orderedDays.length + padding * 2;
    const height = headerHeight + rowHeight * numSlots + padding * 2 + 40;

    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    // neoPOP export skin
    ctx.fillStyle = "#0a0a0c";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#cfff04";
    ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("timetable.", width / 2, 35);

    let x = padding;
    let y = padding + headerHeight;

    ctx.fillStyle = "#17171b";
    ctx.fillRect(x, y - headerHeight, timeColWidth, headerHeight);
    ctx.strokeStyle = "#2a2a31";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y - headerHeight, timeColWidth, headerHeight);

    ctx.fillStyle = "#8b8b95";
    ctx.font = "600 14px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Time", x + timeColWidth / 2, y - headerHeight / 2 + 5);

    orderedDays.forEach((day, dayIdx) => {
      const dayX = x + timeColWidth + dayColWidth * dayIdx;
      ctx.fillStyle = "#6533f4";
      ctx.fillRect(dayX, y - headerHeight, dayColWidth, headerHeight);
      ctx.strokeStyle = "#000000";
      ctx.strokeRect(dayX, y - headerHeight, dayColWidth, headerHeight);

      ctx.fillStyle = "#f4f2ea";
      ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(day, dayX + dayColWidth / 2, y - headerHeight / 2 + 5);
    });

    for (let slot = 1; slot <= numSlots; slot++) {
      const slotY = y + rowHeight * (slot - 1);

      ctx.fillStyle = "#17171b";
      ctx.fillRect(x, slotY, timeColWidth, rowHeight);
      ctx.strokeStyle = "#2a2a31";
      ctx.strokeRect(x, slotY, timeColWidth, rowHeight);

      ctx.fillStyle = "#cfff04";
      ctx.font = "500 12px system-ui, -apple-system, sans-serif";
      const formatSetting = localStorage.getItem("time_format") || "12";
      const startFormatted = formatTimeStr(slotTimes[slot].start, formatSetting);
      const endFormatted = formatTimeStr(slotTimes[slot].end, formatSetting);
      const timeText = `${startFormatted} - ${endFormatted}`;
      ctx.textAlign = "center";
      ctx.fillText(timeText, x + timeColWidth / 2, slotY + rowHeight / 2 + 4);

      orderedDays.forEach((day, dayIdx) => {
        const dayX = x + timeColWidth + dayColWidth * dayIdx;
        const daySlots = timetable[day] || {};
        const classInfo = daySlots[slot.toString()];

        ctx.fillStyle = classInfo && classInfo !== "-" ? "#131316" : "#0a0a0c";
        ctx.fillRect(dayX, slotY, dayColWidth, rowHeight);
        ctx.strokeStyle = "#2a2a31";
        ctx.strokeRect(dayX, slotY, dayColWidth, rowHeight);

        if (classInfo && classInfo !== "-") {
          const displayContent = replaceCourseCodeWithCustomName(classInfo);
          const maxWidth = dayColWidth - cellPadding * 2;
          ctx.fillStyle = "#f4f2ea";
          ctx.font = "600 11px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "left";

          const words = displayContent.split(" ");
          let line = "";
          let lineY = slotY + cellPadding + 12;

          words.forEach((word) => {
            const testLine = line + word + " ";
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && line !== "") {
              ctx.fillText(line, dayX + cellPadding, lineY);
              line = word + " ";
              lineY += 14;
            } else {
              line = testLine;
            }
          });
          ctx.fillText(line, dayX + cellPadding, lineY);
        }
      });
    }

    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#8b8b95";
    ctx.font = "italic 14px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("timetable.", width - 20, height - 15);
    ctx.restore();

    return canvas;
  }, [timetable, slotTimes]);

  const exportAsImage = useCallback(async () => {
    if (!timetable || Object.keys(timetable).length === 0) return;
    setExporting(true);

    try {
      const canvas = generateHighQualityCanvas();
      if (!canvas) {
        alert("Failed to generate image");
        setExporting(false);
        return;
      }

      const fileName = `Timetable_${new Date().toISOString().split("T")[0]}.png`;

      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert("Failed to generate image");
          setExporting(false);
          return;
        }

        if (navigator.share && navigator.canShare) {
          try {
            const file = new File([blob], fileName, { type: "image/png" });
            const shareData = {
              files: [file],
              title: "My Timetable",
              text: "Check out my timetable!",
            };

            if (navigator.canShare(shareData)) {
              await navigator.share(shareData);
              setExporting(false);
              return;
            }
          } catch (shareError) {
            if (shareError.name !== "AbortError") {
              console.log("Share failed, falling back to download:", shareError);
            }
          }
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        setExporting(false);
      }, "image/png", 1.0);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. Please try again.");
      setExporting(false);
    }
  }, [timetable, generateHighQualityCanvas]);

  const activeBlocks = mergeDaySlots(timetable[activeDay], maxSlots);

  return (
    <NeoShell onRefresh={refreshTimetable} refreshMode="direct" autoSyncing={autoSyncing}>
      <div className="np-pagehead">
        <span className="np-eyebrow">full schedule</span>
        <h1 className="np-pagehead__title">the week<i>.</i></h1>
      </div>

      {days.length === 0 ? (
        <div className="np-empty">
          <h2 className="np-empty__title">no timetable loaded</h2>
          <p className="np-empty__text">Sign in again or hit resync to pull it from ERP.</p>
        </div>
      ) : (
        <>
          <div className="np-tabs" role="tablist" aria-label="Day">
            {days.map((day) => (
              <button
                key={day}
                role="tab"
                aria-selected={activeDay === day}
                className={`np-tab${activeDay === day ? " is-active" : ""}`}
                onClick={() => setActiveDay(day)}
              >
                {day}{day === todayName ? " ·" : ""}
              </button>
            ))}
          </div>

          {activeBlocks.length === 0 ? (
            <div className="np-empty">
              <h2 className="np-empty__title">nothing on {activeDay}</h2>
              <p className="np-empty__text">A full day off. Use it well.</p>
            </div>
          ) : (
            activeBlocks.map((block, idx) => (
              <div key={idx} className="np-block">
                <div className="np-block__time">
                  {formatTimeStr(slotTimes[block.startSlot].start, localStorage.getItem("time_format") || "12")}
                  <small>{formatTimeStr(slotTimes[block.endSlot].end, localStorage.getItem("time_format") || "12")}</small>
                  <span style={{ fontSize: "9px", color: "var(--np-muted)", opacity: 0.5, marginTop: "4px", fontWeight: 500 }}>
                    Slot {block.startSlot}{block.startSlot !== block.endSlot ? `–${block.endSlot}` : ""}
                  </span>
                </div>
                <div className="np-block__name">
                  {replaceCourseCodeWithCustomName(block.content)}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {days.length > 0 && (
        <>
          <button
            className="np-fab np-fab--2"
            onClick={() => setShowTableView(true)}
            title="Table View"
          >
            <FiGrid size={20} />
          </button>
          <button
            className="np-fab np-fab--1"
            onClick={exportAsImage}
            disabled={exporting}
            title="Share timetable"
          >
            {exporting ? "…" : <FiShare2 size={20} />}
          </button>
        </>
      )}

      {/* Table View Modal */}
      <NeoModal
        open={showTableView}
        title="weekly schedule"
        onClose={() => setShowTableView(false)}
        wide
      >
        <div style={{ overflowX: "auto", margin: "-6px 0", borderRadius: 0 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "11px",
              fontFamily: "var(--np-font-ui, 'Space Grotesk', sans-serif)",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--np-line)",
                    background: "var(--np-panel)",
                    color: "var(--np-muted)",
                    textAlign: "center",
                    textTransform: "uppercase",
                    fontSize: "10px",
                    letterSpacing: "0.1em",
                    whiteSpace: "nowrap",
                  }}
                >
                  Time
                </th>
                {days.map((day) => {
                  const isToday = day === todayName;
                  return (
                    <th
                      key={day}
                      style={{
                        padding: "10px 12px",
                        border: isToday ? "1px solid #000" : "1px solid var(--np-line)",
                        background: isToday ? "var(--np-acid)" : "var(--np-panel)",
                        color: isToday ? "#0a0a0c" : "var(--np-cream)",
                        fontWeight: 700,
                        textAlign: "center",
                        textTransform: "uppercase",
                        fontSize: "11px",
                        letterSpacing: "0.08em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {day}{isToday ? " ·" : ""}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxSlots }, (_, idx) => idx + 1).map((slot) => (
                <tr key={slot}>
                  <td
                    style={{
                      padding: "8px 10px",
                      border: "1px solid var(--np-line)",
                      background: "var(--np-well)",
                      color: "var(--np-acid)",
                      fontSize: "10.5px",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      textAlign: "center",
                      fontFamily: "var(--np-font-ui)",
                    }}
                  >
                    {formatTimeStr(slotTimes[slot]?.start, localStorage.getItem("time_format") || "12")}<br />
                    <span style={{ opacity: 0.65, fontSize: "9.5px", color: "var(--np-muted)" }}>
                      {formatTimeStr(slotTimes[slot]?.end, localStorage.getItem("time_format") || "12")}
                    </span>
                    <span style={{ display: "block", fontSize: "8.5px", opacity: 0.5, color: "var(--np-muted)", marginTop: "2px", fontWeight: 400 }}>
                      Slot {slot}
                    </span>
                  </td>
                  {days.map((day) => {
                    const classInfo = timetable[day]?.[slot.toString()];
                    const isClass = classInfo && classInfo !== "-";
                    const isToday = day === todayName;
                    return (
                      <td
                        key={day}
                        style={{
                          padding: "8px 10px",
                          border: "1px solid var(--np-line)",
                          background: isClass
                            ? isToday
                              ? "rgba(207, 255, 4, 0.06)"
                              : "var(--np-carbon)"
                            : "var(--np-void)",
                          color: isClass ? "var(--np-cream)" : "var(--np-faint)",
                          fontWeight: isClass ? 600 : 400,
                          fontSize: "11px",
                          textAlign: "center",
                          minWidth: 110,
                          borderLeft: isClass
                            ? isToday
                              ? "3px solid var(--np-acid)"
                              : "3px solid var(--np-purple)"
                            : "1px solid var(--np-line)",
                        }}
                      >
                        {isClass ? replaceCourseCodeWithCustomName(classInfo) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
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
