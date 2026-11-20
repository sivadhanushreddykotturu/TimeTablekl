// Renders the whole week as a shareable PNG, in the active theme's colours.
import { getSlotTimes, getMaxSlots, formatTimeStr } from "../../utils/slotTimes";
import { replaceCourseCodeWithCustomName } from "../../utils/subjectMapper";
import { DAY_ORDER, getTimeFormat } from "../../utils/schedule";
import { getCSSColor } from "./cssColor";

const FONT = "'JetBrains Sans', system-ui, -apple-system, sans-serif";

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function renderTimetableCanvas(timetable) {
  const days = DAY_ORDER.filter((day) => timetable?.[day]);
  if (days.length === 0) return null;

  const slotTimes = getSlotTimes();
  const numSlots = getMaxSlots();
  const format = getTimeFormat();

  const scale = 2;
  const padding = 40;
  const titleHeight = 56;
  const headerHeight = 48;
  const rowHeight = 54;
  const timeColWidth = 104;
  const dayColWidth = 200;
  const gap = 4;
  const cellPadding = 12;

  const width = timeColWidth + dayColWidth * days.length + padding * 2;
  const height = titleHeight + headerHeight + rowHeight * numSlots + padding * 2 + 20;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  const color = {
    bg: getCSSColor("--np-void"),
    card: getCSSColor("--np-carbon"),
    raised: getCSSColor("--np-panel"),
    text: getCSSColor("--np-cream"),
    muted: getCSSColor("--np-muted"),
    accent: getCSSColor("--np-acid"),
  };

  ctx.fillStyle = color.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = color.text;
  ctx.font = `700 28px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Timetable", padding, padding + 14);

  const top = padding + titleHeight;

  // day headers
  days.forEach((day, i) => {
    const x = padding + timeColWidth + dayColWidth * i;
    ctx.fillStyle = color.raised;
    roundRect(ctx, x + gap / 2, top, dayColWidth - gap, headerHeight - gap, 10);
    ctx.fill();
    ctx.fillStyle = color.text;
    ctx.font = `600 15px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(day, x + dayColWidth / 2, top + (headerHeight - gap) / 2);
  });

  for (let slot = 1; slot <= numSlots; slot++) {
    const y = top + headerHeight + rowHeight * (slot - 1);

    // time column
    ctx.textAlign = "left";
    ctx.fillStyle = color.text;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(formatTimeStr(slotTimes[slot].start, format), padding, y + rowHeight / 2 - 8);
    ctx.fillStyle = color.muted;
    ctx.font = `500 11px ${FONT}`;
    ctx.fillText(formatTimeStr(slotTimes[slot].end, format), padding, y + rowHeight / 2 + 8);

    days.forEach((day, i) => {
      const x = padding + timeColWidth + dayColWidth * i;
      const classInfo = timetable[day]?.[slot.toString()];
      if (!classInfo || classInfo === "-") return;

      ctx.fillStyle = color.card;
      roundRect(ctx, x + gap / 2, y, dayColWidth - gap, rowHeight - gap, 10);
      ctx.fill();

      // word-wrap the class name, two lines max
      const maxWidth = dayColWidth - gap - cellPadding * 2;
      ctx.fillStyle = color.text;
      ctx.font = `600 11px ${FONT}`;
      ctx.textAlign = "left";

      const lines = [];
      let line = "";
      replaceCourseCodeWithCustomName(classInfo).split(" ").forEach((word) => {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      });
      if (line) lines.push(line);

      const shown = lines.slice(0, 2);
      const firstY = y + (rowHeight - gap) / 2 - ((shown.length - 1) * 14) / 2;
      shown.forEach((text, n) => ctx.fillText(text, x + gap / 2 + cellPadding, firstY + n * 14));
    });
  }

  ctx.globalAlpha = 0.5;
  ctx.fillStyle = color.muted;
  ctx.font = `500 13px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText("timetablekl.vercel.app", width - padding, height - 22);
  ctx.globalAlpha = 1;

  return canvas;
}

/** Shares the image through the system share sheet, or downloads it where that isn't available. */
export async function shareTimetableImage(timetable) {
  const canvas = renderTimetableCanvas(timetable);
  if (!canvas) throw new Error("Nothing to export yet.");

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1.0));
  if (!blob) throw new Error("Failed to generate the image.");

  const fileName = `Timetable_${new Date().toISOString().split("T")[0]}.png`;

  if (navigator.share && navigator.canShare) {
    try {
      const shareData = {
        files: [new File([blob], fileName, { type: "image/png" })],
        title: "My Timetable",
        text: "Check out my timetable!",
      };
      if (navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return;
      }
    } catch (error) {
      if (error.name === "AbortError") return; // user closed the share sheet
      // anything else: fall through to a plain download
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
}
