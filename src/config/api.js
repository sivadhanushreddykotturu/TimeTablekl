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


// Helper function to get form data with common fields
// Now includes username, password AND cookie fields for self-healing backend
export const getFormData = (username, password, captcha, semester, academicYear, sessionId) => {
  const form = new FormData();
  form.append("username", username);
  form.append("password", password);
  form.append("academic_year_code", getAcademicYearCode(academicYear));
  // Fallback for legacy/invalid semester keys (e.g., removed options)
  form.append("semester_id", SEMESTER_MAP[semester] || SEMESTER_MAP["even"]);

  // Append cookie fields for self-healing routes
  const stored = _getStoredCookies();
  form.append("php_sess_id", stored.php_sess_id);
  form.append("csrf_cookie", stored.csrf_cookie);
  form.append("device_id", stored.device_id);
  form.append("server_id", stored.server_id);

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
export const getSeatingFormData = (username, password, captcha, sessionId) => {
  const form = new FormData();
  form.append("username", username);
  form.append("password", password);

  // Append cookie fields for self-healing routes
  const stored = _getStoredCookies();
  form.append("php_sess_id", stored.php_sess_id);
  form.append("csrf_cookie", stored.csrf_cookie);
  form.append("device_id", stored.device_id);
  form.append("server_id", stored.server_id);

  return form;
};

// Helper function to get form data for register detail (lazy fetch)
export const getRegisterDetailFormData = (username, password, registerHref) => {
  const form = new FormData();
  form.append("username", username);
  form.append("password", password);
  form.append("register_href", registerHref);

  // Append cookie fields for self-healing routes
  const stored = _getStoredCookies();
  form.append("php_sess_id", stored.php_sess_id);
  form.append("csrf_cookie", stored.csrf_cookie);
  form.append("device_id", stored.device_id);
  form.append("server_id", stored.server_id);

  return form;
};
