// API Configuration
// These URLs are used throughout the application
// In production, these should be moved to environment variables

export const API_CONFIG = {
  // Login/Data fetch endpoint (also fetches timetable)
  FETCH_URL: import.meta.env.VITE_FETCH_URL,

  // Attendance fetch endpoint
  ATTENDANCE_URL: import.meta.env.VITE_ATTENDANCE_URL,

  // Seating plan fetch endpoint
  SEATING_URL: import.meta.env.VITE_SEATING,

  // Register detail (lazy-load on click) endpoint
  REGISTER_DETAIL_URL: import.meta.env.VITE_REGISTER_DETAIL_URL,

  // CGPA summary (all graded courses)
  CGPA_URL: import.meta.env.VITE_CGPA_URL,

  // Per-course marks scorecard (lazy-load via target_href)
  MARKS_DETAIL_URL: import.meta.env.VITE_MARKS_DETAIL_URL,
};

// Semester mapping
export const SEMESTER_MAP = {
  'odd': '1',
  'even': '2',
  'summer': '3',
  // - Term3 uses semester_id=4
  'term3': '4',
};

export const getAcademicYearCode = (academicYear) => {
  const firstYear = parseInt(academicYear.split('-')[0]);
  return (16 + (firstYear - 2024) * 3).toString();
};

// Helper: reads stored session cookies (getCookies is an alias for getStoredCookies)
import { getCookies } from "../../utils/storage.js";

const _getStoredCookies = () => {
  const cookies = getCookies();
  return {
    php_sess_id: cookies?.PHPSESSID || "",
    csrf_cookie: cookies?._csrf_token || cookies?._csrf || "",
    device_id:   cookies?.kl_erp_device_id || "",
    server_id:   cookies?.SERVERID || "erp3",
  };
};

/** @param {FormData} form @param {{ useStoredCookies?: boolean }} options */
const _appendSessionCookies = (form, { useStoredCookies = true } = {}) => {
  if (!useStoredCookies) {
    form.append("php_sess_id", "");
    form.append("csrf_cookie", "");
    form.append("device_id", "");
    form.append("server_id", "erp3");
    return;
  }
  const stored = _getStoredCookies();
  form.append("php_sess_id", stored.php_sess_id);
  form.append("csrf_cookie", stored.csrf_cookie);
  form.append("device_id", stored.device_id);
  form.append("server_id", stored.server_id);
};

// Helper function to get form data with common fields
// Now includes username, password AND cookie fields for self-healing backend
// Pass { useStoredCookies: false } for friend/other-account requests (cold login).
export const getFormData = (
  username,
  password,
  captcha,
  semester,
  academicYear,
  sessionId,
  options = {}
) => {
  const form = new FormData();
  form.append("username", username);
  form.append("password", password);
  form.append("academic_year_code", getAcademicYearCode(academicYear));
  form.append("semester_id", SEMESTER_MAP[semester] || SEMESTER_MAP["even"]);

  _appendSessionCookies(form, options);

  return form;
};

// Helper function to get current academic year options
export const getCurrentAcademicYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const options = [];

  // Add current year and previous year
  options.push(`${currentYear - 1}-${currentYear.toString().slice(-2)}`);
  options.push(`${currentYear}-${(currentYear + 1).toString().slice(-2)}`);

  return options;
};

// Helper function to get form data for seating plan
// Now includes cookie fields for self-healing backend
export const getSeatingFormData = (username, password, captcha, sessionId, options = {}) => {
  const form = new FormData();
  form.append("username", username);
  form.append("password", password);

  _appendSessionCookies(form, options);

  return form;
};

// Helper function to get form data for register detail (lazy fetch)
export const getRegisterDetailFormData = (username, password, registerHref, options = {}) => {
  const form = new FormData();
  form.append("username", username);
  form.append("password", password);
  form.append("register_href", registerHref);

  _appendSessionCookies(form, options);

  return form;
};

// Helper function to get form data for marks detail (lazy fetch)
export const getMarksDetailFormData = (username, password, targetHref, options = {}) => {
  const form = new FormData();
  form.append("username", username);
  form.append("password", password);
  form.append("target_href", targetHref);

  _appendSessionCookies(form, options);

  return form;
};
