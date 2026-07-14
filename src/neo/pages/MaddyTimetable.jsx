import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiShare2, FiArrowLeft } from "react-icons/fi";
import NeoShell from "../Shell.jsx";
import Toast from "../../components/Toast.jsx";
import { getSlotTimes, getMaxSlots } from "../../utils/slotTimes";

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SEMESTER_NAMES = {
  odd: "odd sem",
  even: "even sem",
  summer: "summer",
  term3: "term 3",
};

export default function NeoMaddyTimetable() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [maddy, setMaddy] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [exporting, setExporting] = useState(false);
  const [activeDay, setActiveDay] = useState(null);

  useEffect(() => {
    const maddys = JSON.parse(localStorage.getItem("maddys") || "[]");
    const foundMaddy = maddys.find(m => m.id === parseInt(id));

    if (!foundMaddy) {
      setToast({ show: true, message: "Friend not found", type: "error" });
      setTimeout(() => navigate("/maddys"), 2000);
      return;
    }

    setMaddy(foundMaddy);
    const days = DAY_ORDER.filter((day) => foundMaddy.timetable?.[day]);
    const todayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
    setActiveDay(days.includes(todayName) ? todayName : days[0] || null);
  }, [id, navigate]);

  const generateHighQualityCanvas = useCallback(() => {
    if (!maddy || !maddy.timetable || Object.keys(maddy.timetable).length === 0) return null;

    const slotTimes = getSlotTimes(maddy.username);
    const maxSlots = getMaxSlots(maddy.username);

    const scale = 2;
    const padding = 40;
    const cellPadding = 12;
    const headerHeight = 60;
    const rowHeight = 50;
    const timeColWidth = 100;
    const dayColWidth = 200;

    const orderedDays = DAY_ORDER.filter(day => maddy.timetable[day]);
    if (orderedDays.length === 0) return null;

    const numSlots = maxSlots;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const width = timeColWidth + (dayColWidth * orderedDays.length) + (padding * 2);
    const height = headerHeight + (rowHeight * numSlots) + (padding * 2) + 40;

    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#cfff04';
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${maddy.name}'s Timetable`, width / 2, 35);

    let x = padding;
    let y = padding + headerHeight;

    ctx.fillStyle = '#17171b';
    ctx.fillRect(x, y - headerHeight, timeColWidth, headerHeight);
    ctx.strokeStyle = '#2a2a31';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y - headerHeight, timeColWidth, headerHeight);

    ctx.fillStyle = '#8b8b95';
    ctx.font = '600 14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Time', x + timeColWidth / 2, y - headerHeight / 2 + 5);

    orderedDays.forEach((day, dayIdx) => {
      const dayX = x + timeColWidth + (dayColWidth * dayIdx);
      ctx.fillStyle = '#6533f4';
      ctx.fillRect(dayX, y - headerHeight, dayColWidth, headerHeight);
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(dayX, y - headerHeight, dayColWidth, headerHeight);

      ctx.fillStyle = '#f4f2ea';
      ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(day, dayX + dayColWidth / 2, y - headerHeight / 2 + 5);
    });

    for (let slot = 1; slot <= numSlots; slot++) {
      const slotY = y + (rowHeight * (slot - 1));

      ctx.fillStyle = '#17171b';
      ctx.fillRect(x, slotY, timeColWidth, rowHeight);
      ctx.strokeStyle = '#2a2a31';
      ctx.strokeRect(x, slotY, timeColWidth, rowHeight);

      ctx.fillStyle = '#cfff04';
      ctx.font = '500 12px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      const timeText = `${slotTimes[slot].start} - ${slotTimes[slot].end}`;
      ctx.fillText(timeText, x + timeColWidth / 2, slotY + rowHeight / 2 + 4);

      orderedDays.forEach((day, dayIdx) => {
        const dayX = x + timeColWidth + (dayColWidth * dayIdx);
        const daySlots = maddy.timetable[day] || {};
        const classInfo = daySlots[slot.toString()];

        ctx.fillStyle = classInfo && classInfo !== '-' ? '#131316' : '#0a0a0c';
        ctx.fillRect(dayX, slotY, dayColWidth, rowHeight);
        ctx.strokeStyle = '#2a2a31';
        ctx.strokeRect(dayX, slotY, dayColWidth, rowHeight);

        if (classInfo && classInfo !== '-') {
          const maxWidth = dayColWidth - (cellPadding * 2);
          ctx.fillStyle = '#f4f2ea';
          ctx.font = '600 11px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'left';

          const words = classInfo.split(' ');
          let line = '';
          let lineY = slotY + cellPadding + 12;

          words.forEach((word) => {
            const testLine = line + word + ' ';
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && line !== '') {
              ctx.fillText(line, dayX + cellPadding, lineY);
              line = word + ' ';
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
    ctx.fillStyle = '#8b8b95';
    ctx.font = 'italic 14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('timetable.', width - 20, height - 15);
    ctx.restore();

    return canvas;
  }, [maddy]);

  const exportAsImage = useCallback(async () => {
    if (!maddy || !maddy.timetable || Object.keys(maddy.timetable).length === 0) return;
    setExporting(true);

    try {
      const canvas = generateHighQualityCanvas();
      if (!canvas) {
        alert('Failed to generate image');
        setExporting(false);
        return;
      }

      const fileName = `${maddy.name}_Timetable_${new Date().toISOString().split('T')[0]}.png`;

      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert('Failed to generate image');
          setExporting(false);
          return;
        }

        if (navigator.share && navigator.canShare) {
          try {
            const file = new File([blob], fileName, { type: 'image/png' });
            const shareData = {
              files: [file],
              title: `${maddy.name}'s Timetable`,
              text: `Check out ${maddy.name}'s timetable!`
            };

            if (navigator.canShare(shareData)) {
              await navigator.share(shareData);
              setExporting(false);
              return;
            }
          } catch (shareError) {
            if (shareError.name !== 'AbortError') {
              console.log('Share failed, falling back to download:', shareError);
            }
          }
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        setExporting(false);
      }, 'image/png', 1.0);

    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
      setExporting(false);
    }
  }, [maddy, generateHighQualityCanvas]);

  if (!maddy) {
    return (
      <NeoShell>
        <div className="np-loading">
          <div className="np-loading__blocks" aria-hidden="true"><span /><span /><span /><span /></div>
          <div className="np-loading__text">loading…</div>
        </div>
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.show}
          onClose={() => setToast(prev => ({ ...prev, show: false }))}
        />
      </NeoShell>
    );
  }

  const slotTimes = getSlotTimes(maddy.username);
  const maxSlots = getMaxSlots(maddy.username);
  const days = DAY_ORDER.filter((day) => maddy.timetable?.[day]);
  const todayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];

  const mergeDaySlots = (slots) => {
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
  };

  const activeBlocks = activeDay ? mergeDaySlots(maddy.timetable[activeDay]) : [];

  return (
    <NeoShell>
      <div className="np-pagehead">
        <button className="np-iconbtn" style={{ marginBottom: 14 }} onClick={() => navigate("/maddys")}>
          <FiArrowLeft size={13} /> back to docs
        </button>
        <span className="np-eyebrow">
          {SEMESTER_NAMES[maddy.semester] || maddy.semester} · {maddy.academicYear}
        </span>
        <h1 className="np-pagehead__title">{maddy.name}'s week<i>.</i></h1>
      </div>

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
          <p className="np-empty__text">{maddy.name} is free all day.</p>
        </div>
      ) : (
        activeBlocks.map((block, index) => (
          <div key={index} className="np-block">
            <div className="np-block__time">
              {slotTimes[block.startSlot].start}
              <small>{slotTimes[block.endSlot].end}</small>
            </div>
            <div className="np-block__name">{block.content}</div>
          </div>
        ))
      )}

      {maddy.timetable && Object.keys(maddy.timetable).length > 0 && (
        <button
          className="np-fab np-fab--1"
          onClick={exportAsImage}
          disabled={exporting}
          title="Share timetable"
        >
          {exporting ? "…" : <FiShare2 size={20} />}
        </button>
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </NeoShell>
  );
}
