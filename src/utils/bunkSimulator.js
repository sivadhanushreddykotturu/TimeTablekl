import { getSlotTimes, getMaxSlots, formatTimeStr } from "./slotTimes";
import { extractMainCode } from "./subjectMapper";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const LTPS_WEIGHTS = {
  L: 100, // Lecture
  T: 100, // Tutorial
  P: 50,  // Practical / Lab
  S: 25,  // Skilling
  O: 1    // Other
};

/**
 * Extracts component type (L, T, P, S) from timetable slot string.
 * e.g., "ASE-L - S-65" -> "L", "24CS3105-P - S-12" -> "P"
 */
export function extractComponentType(slotContent) {
  if (!slotContent) return "L";
  const upper = slotContent.toUpperCase();

  // Pattern 1: -L, -P, -T, -S separated by dash or space
  const match = upper.match(/[-_ ]([LTPS])(\b|[-_ ])/);
  if (match) return match[1];

  if (upper.includes("LAB") || upper.includes("PRACTICAL")) return "P";
  if (upper.includes("SKILLING")) return "S";
  if (upper.includes("TUTORIAL")) return "T";
  if (upper.includes("LECTURE")) return "L";

  return "L";
}

/**
 * Merges consecutive identical slots in a day's timetable.
 * Calculates duration in hours as (endSlot - startSlot + 1).
 */
export function mergeDaySlotsWithHours(slots = {}, maxSlots = 14) {
  const slotTimes = getSlotTimes();
  const formatSetting = (typeof window !== "undefined" && localStorage.getItem("time_format")) || "12";

  const entries = Object.entries(slots || {})
    .filter(([slot]) => parseInt(slot, 10) <= maxSlots)
    .map(([slot, value]) => [parseInt(slot, 10), value])
    .sort((a, b) => a[0] - b[0]);

  const merged = [];
  let i = 0;

  while (i < entries.length) {
    const [startSlot, value] = entries[i];
    if (!value || value === "-") {
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

    const hours = endSlot - startSlot + 1;
    const startTimeRaw = slotTimes[startSlot]?.start || "";
    const endTimeRaw = slotTimes[endSlot]?.end || "";
    const startTime = startTimeRaw ? formatTimeStr(startTimeRaw, formatSetting) : `Slot ${startSlot}`;
    const endTime = endTimeRaw ? formatTimeStr(endTimeRaw, formatSetting) : `Slot ${endSlot}`;
    const slotLabel = startSlot === endSlot ? `Slot ${startSlot}` : `Slot ${startSlot}–${endSlot}`;

    merged.push({
      content: value,
      startSlot,
      endSlot,
      hours,
      startTime,
      endTime,
      slotLabel
    });

    i++;
  }

  return merged;
}

/**
 * Checks if a timetable slot content matches a selected course.
 */
export function matchesCourse(slotContent, courseCode, courseName) {
  if (!slotContent || slotContent === "-") return false;
  const contentUpper = slotContent.toUpperCase();

  // 1. Direct course code match (e.g. 24CS3105 or 24AD01HF)
  if (courseCode) {
    const codeUpper = courseCode.toUpperCase();
    if (contentUpper.includes(codeUpper)) return true;

    const mainCode = extractMainCode(courseCode).toUpperCase();
    if (mainCode && contentUpper.includes(mainCode)) return true;

    // Check mapped subject name (e.g. IAS or ASE)
    try {
      const subjectMappings = JSON.parse(localStorage.getItem("subjectMappings") || "{}");
      const mapped = subjectMappings[mainCode] || subjectMappings[courseCode];
      if (mapped && contentUpper.includes(mapped.toUpperCase())) return true;
    } catch (_) {}
  }

  // 2. Acronym or title word match from courseName
  if (courseName) {
    const cleanName = courseName.trim().toUpperCase();
    if (contentUpper.includes(cleanName)) return true;

    const words = cleanName.split(/\s+/).filter(w => w.length > 2 && !["AND", "THE", "FOR", "WITH"].includes(w));
    if (words.length > 0 && words.some(w => contentUpper.includes(w))) {
      return true;
    }
  }

  return false;
}

/**
 * Finds all classes scheduled for a course between startDate and endDate (inclusive).
 * Initial status is 'neutral' (scheduled, not yet modified).
 */
export function findClassesInRange(timetable = {}, courseCode = "", courseName = "", startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr || !timetable) return [];

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

  const maxSlots = getMaxSlots();
  const classes = [];
  const current = new Date(start);

  while (current <= end) {
    const dayIndex = current.getDay();
    const dayName = DAY_NAMES[dayIndex];

    // Skip Sundays
    if (dayName !== "Sun" && timetable[dayName]) {
      const daySlots = mergeDaySlotsWithHours(timetable[dayName], maxSlots);
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, "0");
      const dateNum = String(current.getDate()).padStart(2, "0");
      const isoDate = `${year}-${month}-${dateNum}`;

      const dateDisplay = current.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric"
      });

      daySlots.forEach(block => {
        if (matchesCourse(block.content, courseCode, courseName)) {
          let room = "";
          const componentType = extractComponentType(block.content);

          const parts = block.content.split("-").map(p => p.trim());
          parts.forEach(part => {
            if (/^RoomNo/i.test(part) || /^Room/i.test(part) || /^[A-Z]\d{3}/.test(part)) {
              room = part;
            }
          });

          const componentLabels = {
            L: "Lecture",
            T: "Tutorial",
            P: "Practical (Lab)",
            S: "Skilling"
          };

          classes.push({
            id: `${isoDate}_${block.startSlot}_${block.endSlot}`,
            date: isoDate,
            dateDisplay,
            dayName,
            hours: block.hours,
            startSlot: block.startSlot,
            endSlot: block.endSlot,
            slotLabel: block.slotLabel,
            time: `${block.startTime} – ${block.endTime}`,
            content: block.content,
            room: room || "Regular Hall",
            componentType,
            componentLabel: componentLabels[componentType] || "Lecture",
            weight: LTPS_WEIGHTS[componentType] || 100,
            status: "attend" // 'attend' (present, default) | 'bunk' (absent)
          });
        }
      });
    }

    current.setDate(current.getDate() + 1);
  }

  return classes;
}

/**
 * Calculates current and simulated attendance using the official ERP LTPS WEIGHTED formula.
 * Formula: Overall % = Sum(Attended_i * Weight_i) / Sum((Conducted_i - TCBR_i) * Weight_i) * 100
 */
export function calculateAttendanceImpact(course, classesList = [], includeTcbr = true, targetPercentage = 85) {
  if (!course) {
    return {
      currentPercentage: 0,
      simulatedPercentage: 0,
      delta: 0,
      currentAttended: 0,
      currentConducted: 0,
      simulatedAttended: 0,
      simulatedConducted: 0,
      tcbr: 0,
      bunkedHours: 0,
      attendedHours: 0,
      hasChanges: false,
      isSafe: true,
      targetPercentage
    };
  }

  // Clone sections for simulation
  const sections = (course.sections && course.sections.length > 0)
    ? course.sections.map(s => {
        const typeChar = (s.ltps || "L").charAt(0).toUpperCase();
        return {
          type: typeChar,
          weight: LTPS_WEIGHTS[typeChar] || LTPS_WEIGHTS.O,
          attended: parseInt(s.totalAttended || s.attended || "0", 10),
          conducted: parseInt(s.totalConducted || s.conducted || "0", 10),
          tcbr: parseInt(s.tcbr || s.Tcbr || "0", 10),
          simAttended: parseInt(s.totalAttended || s.attended || "0", 10),
          simConducted: parseInt(s.totalConducted || s.conducted || "0", 10)
        };
      })
    : [{
        type: "L",
        weight: 100,
        attended: parseInt(course.attended || "0", 10),
        conducted: parseInt(course.conducted || "0", 10),
        tcbr: parseInt(course.tcbr || "0", 10),
        simAttended: parseInt(course.attended || "0", 10),
        simConducted: parseInt(course.conducted || "0", 10)
      }];

  // Track hours modified by user
  let bunkedHours = 0;
  let attendedHours = 0;
  let hasChanges = false;

  classesList.forEach(item => {
    if (item.status === "neutral") return;

    hasChanges = true;
    const hours = item.hours || 1;
    const cType = item.componentType || "L";

    // Match exact section or fallback to first section
    let targetSection = sections.find(s => s.type === cType);
    if (!targetSection) targetSection = sections[0];

    if (item.status === "attend") {
      targetSection.simAttended += hours;
      targetSection.simConducted += hours;
      attendedHours += hours;
    } else if (item.status === "bunk") {
      targetSection.simConducted += hours;
      bunkedHours += hours;
    }
  });

  // Calculate Weighted ERP sums
  let currentWeightedAttended = 0;
  let currentWeightedConducted = 0;
  let simWeightedAttended = 0;
  let simWeightedConducted = 0;

  let totalCurrentAttended = 0;
  let totalCurrentConducted = 0;
  let totalSimAttended = 0;
  let totalSimConducted = 0;
  let totalTcbr = 0;

  sections.forEach(sec => {
    const effectiveTcbr = includeTcbr ? Math.max(0, sec.tcbr) : 0;
    const currentDenom = Math.max(0, sec.conducted - effectiveTcbr);
    const simDenom = Math.max(0, sec.simConducted - effectiveTcbr);

    currentWeightedAttended += sec.attended * sec.weight;
    currentWeightedConducted += currentDenom * sec.weight;

    simWeightedAttended += sec.simAttended * sec.weight;
    simWeightedConducted += simDenom * sec.weight;

    totalCurrentAttended += sec.attended;
    totalCurrentConducted += sec.conducted;
    totalSimAttended += sec.simAttended;
    totalSimConducted += sec.simConducted;
    totalTcbr += effectiveTcbr;
  });

  // ERP rounds percentages up to the next whole number
  const currentPercentage = currentWeightedConducted > 0
    ? Math.ceil((currentWeightedAttended / currentWeightedConducted) * 100 - 1e-9)
    : 0;

  const simulatedPercentage = simWeightedConducted > 0
    ? Math.ceil((simWeightedAttended / simWeightedConducted) * 100 - 1e-9)
    : 0;

  const delta = simulatedPercentage - currentPercentage;
  const isSafe = (hasChanges ? simulatedPercentage : currentPercentage) >= targetPercentage;

  return {
    currentPercentage,
    simulatedPercentage: hasChanges ? simulatedPercentage : currentPercentage,
    delta: hasChanges ? delta : 0,
    currentAttended: totalCurrentAttended,
    currentConducted: totalCurrentConducted,
    simulatedAttended: totalSimAttended,
    simulatedConducted: totalSimConducted,
    tcbr: totalTcbr,
    bunkedHours,
    attendedHours,
    hasChanges,
    isSafe,
    targetPercentage
  };
}
