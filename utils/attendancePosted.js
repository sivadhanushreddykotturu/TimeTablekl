import axios from "axios";
import { getCredentials, handleSessionRefresh } from "./storage.js";
import { getFormData, getRegisterDetailFormData, API_CONFIG } from "../src/config/api.js";
import { parseCell, findAttendanceItem, isPosted } from "../src/utils/attendanceMatch.js";

const ONE_MINUTE_MS = 60 * 1000;

const readCachedAttendance = () => {
  try {
    const cached = JSON.parse(localStorage.getItem("cached_attendance") || "null");
    const fetchedAt = new Date(localStorage.getItem("cached_attendance_time") || 0).getTime();
    return { attendance: Array.isArray(cached) ? cached : null, fresh: Date.now() - fetchedAt < ONE_MINUTE_MS };
  } catch {
    return { attendance: null, fresh: false };
  }
};

// Also renews the ERP session, which the register endpoint needs warm.
const fetchAttendance = async (creds) => {
  const form = getFormData(
    creds.username,
    creds.password,
    "",
    localStorage.getItem("semester") || "odd",
    localStorage.getItem("academicYear") || "2024-25",
    ""
  );
  const res = await axios.post(API_CONFIG.ATTENDANCE_URL, form);
  if (!res.data?.success) return null;
  handleSessionRefresh(res.data);
  try {
    localStorage.setItem("cached_attendance", JSON.stringify(res.data.attendance));
    localStorage.setItem("cached_attendance_time", new Date().toISOString());
  } catch {
    /* ignore storage write error */
  }
  return res.data.attendance;
};

const fetchRegister = async (creds, registerHref) => {
  try {
    const form = getRegisterDetailFormData(creds.username, creds.password, registerHref);
    const res = await axios.post(API_CONFIG.REGISTER_DETAIL_URL, form);
    return res.data?.success ? res.data : null;
  } catch {
    return null;
  }
};

/**
 * Has attendance been posted for `slot` today for the class in timetable cell `content`?
 * Returns { posted: false } | { posted: true, status: "P" | "A" }, or null when the class
 * can't be matched to a register. Throws when the ERP can't be reached.
 */
export const checkAttendancePosted = async (content, slot) => {
  const cell = parseCell(content);
  const creds = getCredentials();
  if (!cell || !creds) return null;

  // Same rule as the Attendance page: cache older than 1 min => session may be cold, renew first.
  const cached = readCachedAttendance();
  let attendance = cached.attendance;
  if (!attendance || !cached.fresh) {
    attendance = (await fetchAttendance(creds).catch(() => null)) || attendance;
  }
  if (!attendance) throw new Error("Couldn't fetch attendance.");

  let item = findAttendanceItem(attendance, cell);
  if (!item?.register_href) return null;

  let register = await fetchRegister(creds, item.register_href);
  if (!register) {
    // Self-heal once: renew session and retry with the (possibly new) register link.
    const renewed = await fetchAttendance(creds).catch(() => null);
    item = findAttendanceItem(renewed || attendance, cell) || item;
    register = await fetchRegister(creds, item.register_href);
  }
  if (!register) throw new Error("Couldn't fetch register.");

  handleSessionRefresh(register);
  return isPosted(register.daily_attendance, new Date(), slot);
};
