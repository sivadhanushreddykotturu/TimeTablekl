// Shared schedule logic: turns the raw ERP timetable ({ Mon: { "1": "24AD3107-L - S-55 - RoomNo-M202", ... } })
// into class blocks with real times, and answers "what is on now / what is next".
import { getSlotTimes, getMaxSlots, formatTimeStr } from "./slotTimes";
import { getSubjectName, replaceCourseCodeWithCustomName } from "./subjectMapper";

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_NAMES = {
  Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday",
  Thu: "Thursday", Fri: "Friday", Sat: "Saturday",
};

const TYPE_LABELS = { L: "Lecture", T: "Tutorial", P: "Practical", S: "Skill" };

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const getTimeFormat = () => localStorage.getItem("time_format") || "12";

/**
 * Pulls the readable parts out of a slot string.
 * Falls back to the raw string as the title when the format is unfamiliar.
 */
export function parseClass(content) {
  const raw = (content || "").trim();
  const code = (raw.match(/^[A-Za-z0-9]+/) || [""])[0];
  const type = (raw.match(/^[A-Za-z0-9]+\s*[-_ ]\s*([LTPS])(?=$|[\s\-_])/i) || [])[1];
  const room = (raw.match(/Room\s*No\.?\s*[-:]?\s*([A-Za-z0-9]+)/i) || [])[1];
  const section = (raw.match(/(?:^|[\s\-_])S\s*-\s*(\d+)/i) || [])[1];
  const parsed = Boolean(code && (type || room));

  return {
    code,
    title: parsed ? getSubjectName(code) : replaceCourseCodeWithCustomName(raw),
    type: type ? type.toUpperCase() : "",
    typeLabel: type ? TYPE_LABELS[type.toUpperCase()] : "",
    room: room || "",
    section: section ? `S-${section}` : "",
  };
}

/** Stable hue (0-359) per course, used to tint its cards. */
export function subjectHue(code) {
  let hash = 0;
  for (const ch of code || "") hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return hash;
}

/** Class blocks for one day: back-to-back slots of the same class are merged. */
export function getDayBlocks(timetable, day) {
  const slotTimes = getSlotTimes();
  const maxSlots = getMaxSlots();
  const entries = Object.entries(timetable?.[day] || {})
    .map(([slot, value]) => [parseInt(slot, 10), value])
    .filter(([slot]) => slot >= 1 && slot <= maxSlots)
    .sort((a, b) => a[0] - b[0]);

  const blocks = [];
  for (let i = 0; i < entries.length; i++) {
    const [startSlot, value] = entries[i];
    if (!value || value === "-") continue;

    let endSlot = startSlot;
    while (
      i + 1 < entries.length &&
      entries[i + 1][1] === value &&
      entries[i + 1][0] === endSlot + 1
    ) {
      endSlot++;
      i++;
    }

    const start = slotTimes[startSlot].start;
    const end = slotTimes[endSlot].end;
    blocks.push({
      content: value,
      startSlot,
      endSlot,
      start,
      end,
      startMin: toMinutes(start),
      endMin: toMinutes(end),
      ...parseClass(value),
    });
  }
  return blocks;
}

export function hasClasses(timetable) {
  return DAY_ORDER.some((day) => getDayBlocks(timetable, day).length > 0);
}

/**
 * Everything the Today screen needs.
 *  - blocks: today's classes, each with status "done" | "live" | "upcoming"
 *  - current / next: the class happening now and the one after it (today only)
 *  - ahead: the next day that has classes ({ day, offset, label, blocks }) or null
 */
export function getDayState(timetable, now = new Date()) {
  const today = DAYS[now.getDay()];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const blocks = getDayBlocks(timetable, today).map((block) => ({
    ...block,
    // A merged block stays "live" across the short break between its slots.
    status: nowMin >= block.endMin ? "done" : nowMin >= block.startMin ? "live" : "upcoming",
    startTimeMs: midnight + block.startMin * 60000,
    endTimeMs: midnight + block.endMin * 60000,
  }));

  const current = blocks.find((b) => b.status === "live") || null;
  const next = blocks.find((b) => b.status === "upcoming") || null;

  let ahead = null;
  for (let offset = 1; offset <= 7 && !ahead; offset++) {
    const day = DAYS[(now.getDay() + offset) % 7];
    const dayBlocks = getDayBlocks(timetable, day);
    if (dayBlocks.length > 0) {
      ahead = {
        day,
        offset,
        label: offset === 1 ? "Tomorrow" : DAY_NAMES[day],
        blocks: dayBlocks,
      };
    }
  }

  return { today, nowMin, blocks, current, next, ahead };
}

export function formatRange(block, format = getTimeFormat()) {
  return `${formatTimeStr(block.start, format)} – ${formatTimeStr(block.end, format)}`;
}

export function formatSlots(block) {
  return block.startSlot === block.endSlot
    ? `Slot ${block.startSlot}`
    : `Slots ${block.startSlot}–${block.endSlot}`;
}

/** 95 -> "1 h 35 min" */
export function formatDuration(minutes) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** "Lecture · M202" (whatever parts the slot string carried). */
export function formatMeta(block, { withSection = false } = {}) {
  return [block.typeLabel, block.room, withSection ? block.section : ""]
    .filter(Boolean)
    .join(" · ");
}

/** Which day the Week screen should open on: today if it has classes, else the next day that does. */
export function getInitialDay(timetable, now = new Date()) {
  const today = DAYS[now.getDay()];
  if (getDayBlocks(timetable, today).length > 0) return today;
  const { ahead } = getDayState(timetable, now);
  if (ahead) return ahead.day;
  return DAY_ORDER.find((day) => timetable?.[day]) || "Mon";
}

/** Date of `day` within the current Monday-based week. */
export function dateInThisWeek(day, now = new Date()) {
  const mondayOffset = (now.getDay() + 6) % 7;
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  date.setDate(date.getDate() - mondayOffset + DAY_ORDER.indexOf(day));
  return date;
}
