// Pure helpers for "is attendance posted for the ongoing slot?" (no browser/network deps,
// so attendanceMatch.check.js can run them under plain node).

const digits = (s) => String(s ?? "").replace(/\D/g, "");

// "24GMI3101HF-P - S-2 -RoomNo-C018" -> { code: "24GMI3101HF", ltps: "P", section: "2" }
export function parseCell(content) {
  const m = String(content ?? "").match(/^([A-Za-z0-9]+)-([A-Za-z])\s*-\s*S-?(\d+)/);
  return m ? { code: m[1].toUpperCase(), ltps: m[2].toUpperCase(), section: m[3] } : null;
}

export function findAttendanceItem(items, cell) {
  if (!Array.isArray(items) || !cell) return null;
  const candidates = items.filter((item) => {
    const code = String(item.course_code ?? item.Coursecode ?? "").toUpperCase();
    const ltps = String(item.type ?? item.Ltps ?? "").charAt(0).toUpperCase();
    // ponytail: prefix-tolerant in case ERP drops/adds a suffix (e.g. "HF"); LTPS + section still disambiguate
    const sameCode = code && (code === cell.code || code.startsWith(cell.code) || cell.code.startsWith(code));
    return sameCode && ltps === cell.ltps;
  });
  if (candidates.length <= 1) return candidates[0] || null;
  return candidates.find((item) => digits(item.section ?? item.Section) === cell.section) || null;
}

// daily_attendance entries look like { date_slot: "16/07/25 H 7", status: "P" | "A" }
export function isPosted(dailyAttendance, date, slot) {
  const yy = String(date.getFullYear()).slice(-2);
  const entry = (dailyAttendance || []).find((e) => {
    const [datePart, hour] = String(e?.date_slot ?? "").split(" H ");
    const [d, m, y] = (datePart || "").trim().split("/");
    return (
      Number(d) === date.getDate() &&
      Number(m) === date.getMonth() + 1 &&
      String(y ?? "").slice(-2) === yy &&
      parseInt(hour, 10) === slot
    );
  });
  return entry ? { posted: true, status: entry.status } : { posted: false };
}
