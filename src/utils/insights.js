/**
 * "Smart" lines for the Today screen: what the day looks like, how long you are
 * free, room changes and exams coming up. Pure functions over data the app
 * already has (timetable state, seating plan); nothing is fetched.
 */
import { formatTimeStr } from "./slotTimes";
import { formatDuration } from "./schedule";

const readJson = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

const building = (room) => ((room || "").match(/^[A-Za-z]+/) || [""])[0].toUpperCase();

const overlapsLunch = (fromMin, toMin) => fromMin < 14 * 60 + 30 && toMin > 11 * 60 + 30;

const dayWord = (offset) => (offset === 0 ? "today" : offset === 1 ? "tomorrow" : `in ${offset} days`);

/**
 * @returns {Array<{id, icon, tone, title, text}>} at most `limit` lines, most useful first.
 *   icon: free | room | exam | day | done
 *   tone: good | warn | info
 */
export function buildInsights(state, { now = new Date(), limit = 3 } = {}) {
  const format = localStorage.getItem("time_format") || "12";
  const seating = readJson("seatingPlan", []);
  const lines = [];
  const add = (priority, line) => lines.push({ priority, ...line });

  const { current, next, blocks, ahead, nowMin } = state;
  const hhmm = (time) => formatTimeStr(time, format);

  // ── exams that are close ──
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  seating
    .map((exam) => {
      const date = new Date(exam.date);
      date.setHours(0, 0, 0, 0);
      return { exam, offset: Math.round((date.getTime() - startOfToday) / 86400000) };
    })
    .filter(({ offset }) => offset >= 0 && offset <= 3)
    .sort((a, b) => a.offset - b.offset)
    .slice(0, 1)
    .forEach(({ exam, offset }) => {
      const room = exam.room_no ? ` in room ${exam.room_no}` : "";
      add(offset === 0 ? 100 : 55, {
        id: "exam",
        icon: "exam",
        tone: offset <= 1 ? "warn" : "info",
        title: `Exam ${dayWord(offset)}`,
        text: `${exam.course_code}${room}${exam.time_slot ? ` · slot ${exam.time_slot}` : ""}`,
      });
    });

  // ── free time before the next class ──
  if (!current && next) {
    const gap = next.startMin - nowMin;
    const long = gap >= 45;
    if (long) {
      add(75, {
        id: "free",
        icon: "free",
        tone: "info",
        title: `Free for ${formatDuration(gap)}`,
        text: overlapsLunch(nowMin, next.startMin)
          ? `Until ${hhmm(next.start)}. Lunch window, then ${next.title}.`
          : `Until ${hhmm(next.start)}, then ${next.title}.`,
      });
    }
  }

  // ── a break right after the current class ──
  if (current && next) {
    const gap = next.startMin - current.endMin;
    if (gap >= 30) {
      add(65, {
        id: "free",
        icon: "free",
        tone: "info",
        title: `${formatDuration(gap)} free after this`,
        text: overlapsLunch(current.endMin, next.startMin)
          ? `${hhmm(current.end)} to ${hhmm(next.start)}. Good time for lunch.`
          : `${hhmm(current.end)} to ${hhmm(next.start)}.`,
      });
    }
  }

  // ── room changes ──
  const from = current || null;
  const to = next || null;
  if (from && to && from.room && to.room && from.room !== to.room) {
    const sameBlock = building(from.room) === building(to.room);
    const gap = to.startMin - from.endMin;
    if (!sameBlock) {
      add(80, {
        id: "room",
        icon: "room",
        tone: "warn",
        title: `Room change: ${from.room} → ${to.room}`,
        text:
          gap < 20
            ? `Different block and only ${formatDuration(gap)} between classes. Head over a little early.`
            : `A different block from where you are now.`,
      });
    }
  } else if (!current && next?.room) {
    const last = [...blocks].reverse().find((b) => b.status === "done" && b.room);
    if (last && building(last.room) !== building(next.room) && next.startMin - nowMin < 25) {
      add(60, {
        id: "room",
        icon: "room",
        tone: "info",
        title: `${next.title} is in ${next.room}`,
        text: `That's a different block from your last class (${last.room}).`,
      });
    }
  }

  // ── the shape of the day ──
  if (blocks.length > 0) {
    const left = blocks.filter((b) => b.status !== "done");
    if (left.length === 0) {
      if (ahead) {
        add(58, {
          id: "done",
          icon: "done",
          tone: "good",
          title: "That's a wrap for today",
          text: `${ahead.label} starts at ${hhmm(ahead.blocks[0].start)} with ${ahead.blocks.length} ${ahead.blocks.length === 1 ? "class" : "classes"}.`,
        });
      } else {
        add(58, { id: "done", icon: "done", tone: "good", title: "That's a wrap for today", text: "No more classes scheduled." });
      }
    } else {
      const classMinutes = blocks.reduce((sum, b) => sum + (b.endMin - b.startMin), 0);
      const lastEnd = blocks[blocks.length - 1];
      const dayText = `${blocks.length - left.length} of ${blocks.length} done · finishes at ${hhmm(lastEnd.end)}`;
      if (blocks.length >= 5 || classMinutes >= 300) {
        add(50, { id: "day", icon: "day", tone: "info", title: `Packed day: ${formatDuration(classMinutes)} of class`, text: dayText });
      } else if (blocks.length <= 2) {
        add(48, { id: "day", icon: "day", tone: "good", title: "Light day", text: dayText });
      } else {
        add(45, { id: "day", icon: "day", tone: "info", title: dayText, text: "" });
      }
    }
  }

  // ── quiet days: say what is next ──
  if (blocks.length === 0 && ahead) {
    add(52, {
      id: "done",
      icon: "done",
      tone: "good",
      title: "No classes today",
      text: `${ahead.label} starts at ${hhmm(ahead.blocks[0].start)} with ${ahead.blocks.length} ${ahead.blocks.length === 1 ? "class" : "classes"}.`,
    });
  }

  // keep each kind once, best first
  const seen = new Set();
  return lines
    .sort((a, b) => b.priority - a.priority)
    .filter((line) => (seen.has(line.id) ? false : seen.add(line.id)))
    .slice(0, limit)
    .map(({ priority: _priority, ...line }) => line); // eslint-disable-line no-unused-vars
}
