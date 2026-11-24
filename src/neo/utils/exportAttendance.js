// Draws the attendance share picture: one rounded card per subject, coloured by how safe it is.
import { getCSSColor } from "./cssColor";

const FONT = "'JetBrains Sans', 'Segoe UI', system-ui, -apple-system, sans-serif";
const COMPONENT_NAMES = { L: "Lecture", T: "Tutorial", P: "Practical", S: "Skill" };
const ORDER = ["L", "T", "P", "S"];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Cuts text with an ellipsis so it fits in the given width. */
function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

const toneFor = (pct, color) => (pct >= 85 ? color.good : pct >= 75 ? color.warn : color.bad);

/**
 * courses: [{ displayName, courseCode, overallPercentage, sections: [{ ltps, totalAttended, totalConducted, totalAbsent, tcbr }] }]
 * options: { title, subtitle, includeTcbr }
 */
export function renderAttendanceCanvas(courses, { title, subtitle, includeTcbr }) {
  const cards = courses
    .map((course) => ({
      ...course,
      rows: ORDER.map((type) => course.sections.find((s) => (s.ltps || "").charAt(0).toUpperCase() === type)).filter(Boolean),
    }))
    .filter((course) => course.rows.length > 0);
  if (cards.length === 0) return null;

  const scale = 3;
  const width = 720;
  const padding = 36;
  const cardGap = 18;
  const cardWidth = width - padding * 2;
  const headHeight = 76;
  const rowHeight = 64;
  const headerBlock = 96;
  const footerBlock = 64;
  const inner = 22;

  const height =
    headerBlock +
    cards.reduce((sum, c) => sum + headHeight + c.rows.length * rowHeight + 10, 0) +
    cardGap * (cards.length - 1) +
    footerBlock;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.textBaseline = "alphabetic";

  const color = {
    bg: getCSSColor("--np-void") || "#0d0d0d",
    card: getCSSColor("--np-carbon") || "#1a1a1a",
    raised: getCSSColor("--np-panel") || "#242424",
    line: getCSSColor("--np-line") || "#2a2e2e",
    text: getCSSColor("--np-cream") || "#f5f7f8",
    soft: getCSSColor("--np-soft") || "#b8bec5",
    muted: getCSSColor("--np-muted") || "#969ca3",
    good: getCSSColor("--np-good") || "#66bb6a",
    warn: getCSSColor("--np-orange") || "#ffc857",
    bad: getCSSColor("--np-pink") || "#e8708f",
  };

  ctx.fillStyle = color.bg;
  ctx.fillRect(0, 0, width, height);

  // header
  ctx.textAlign = "left";
  ctx.fillStyle = color.text;
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText(fit(ctx, title, cardWidth), padding, 62);
  if (subtitle) {
    ctx.fillStyle = color.muted;
    ctx.font = `500 15px ${FONT}`;
    ctx.fillText(subtitle, padding, 86);
  }

  let y = headerBlock;

  cards.forEach((course) => {
    const cardHeight = headHeight + course.rows.length * rowHeight + 10;

    ctx.fillStyle = color.card;
    roundRect(ctx, padding, y, cardWidth, cardHeight, 24);
    ctx.fill();
    ctx.strokeStyle = color.line;
    ctx.lineWidth = 1;
    roundRect(ctx, padding + 0.5, y + 0.5, cardWidth - 1, cardHeight - 1, 24);
    ctx.stroke();

    // subject name, code, overall percentage
    const pct = course.overallPercentage;
    const tone = toneFor(pct, color);

    ctx.textAlign = "right";
    ctx.fillStyle = tone;
    ctx.font = `800 30px ${FONT}`;
    const pctText = `${pct}%`;
    ctx.fillText(pctText, padding + cardWidth - inner, y + 46);
    const pctWidth = ctx.measureText(pctText).width;

    ctx.textAlign = "left";
    ctx.fillStyle = color.text;
    ctx.font = `700 19px ${FONT}`;
    ctx.fillText(fit(ctx, course.displayName, cardWidth - inner * 2 - pctWidth - 16), padding + inner, y + 40);
    ctx.fillStyle = color.muted;
    ctx.font = `500 13px ${FONT}`;
    ctx.fillText(course.courseCode, padding + inner, y + 61);

    // component rows
    course.rows.forEach((section, index) => {
      const rowY = y + headHeight + index * rowHeight;
      const type = (section.ltps || "").charAt(0).toUpperCase();
      const attended = parseInt(section.totalAttended, 10) || 0;
      const conducted = parseInt(section.totalConducted, 10) || 0;
      const tcbr = includeTcbr ? Math.max(0, parseInt(section.tcbr || "0", 10) || 0) : 0;
      const effective = includeTcbr ? Math.max(0, conducted - tcbr) : conducted;
      const rowPct = effective > 0 ? Math.min(100, Math.ceil((attended / effective) * 100)) : 0;
      const rowTone = toneFor(rowPct, color);

      // divider
      ctx.strokeStyle = color.line;
      ctx.beginPath();
      ctx.moveTo(padding + inner, rowY + 0.5);
      ctx.lineTo(padding + cardWidth - inner, rowY + 0.5);
      ctx.stroke();

      // letter badge
      ctx.fillStyle = color.raised;
      roundRect(ctx, padding + inner, rowY + 12, 36, 36, 11);
      ctx.fill();
      ctx.fillStyle = color.text;
      ctx.font = `700 15px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(type, padding + inner + 18, rowY + 36);

      // label + counts
      ctx.textAlign = "left";
      ctx.fillStyle = color.text;
      ctx.font = `600 16px ${FONT}`;
      ctx.fillText(COMPONENT_NAMES[type] || type, padding + inner + 50, rowY + 28);
      ctx.fillStyle = color.muted;
      ctx.font = `500 13px ${FONT}`;
      const absent = parseInt(section.totalAbsent, 10);
      const counts = `${attended} of ${effective}${Number.isFinite(absent) ? ` · ${absent} absent` : ""}`;
      ctx.fillText(counts, padding + inner + 50, rowY + 47);

      // percentage + bar
      ctx.textAlign = "right";
      ctx.fillStyle = rowTone;
      ctx.font = `700 19px ${FONT}`;
      ctx.fillText(`${rowPct}%`, padding + cardWidth - inner, rowY + 30);

      const barWidth = 110;
      const barX = padding + cardWidth - inner - barWidth;
      ctx.fillStyle = color.raised;
      roundRect(ctx, barX, rowY + 42, barWidth, 6, 3);
      ctx.fill();
      if (rowPct > 0) {
        ctx.fillStyle = rowTone;
        roundRect(ctx, barX, rowY + 42, Math.max(6, (barWidth * rowPct) / 100), 6, 3);
        ctx.fill();
      }
    });

    y += cardHeight + cardGap;
  });

  // footer
  ctx.textAlign = "center";
  ctx.fillStyle = color.muted;
  ctx.globalAlpha = 0.7;
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText("timetablekl.vercel.app", width / 2, height - 26);
  ctx.globalAlpha = 1;

  return canvas;
}
