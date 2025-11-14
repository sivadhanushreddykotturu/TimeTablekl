//k API Configuration
// These URLs are used throughout the application
// In production, these should be moved to environment variables

export const API_CONFIG = {
  // CAPTCHA endpoint
  CAPTCHA_URL: import.meta.env.VITE_CAPTCHA_URL ,
  
  // Login/Data fetch endpoint
  FETCH_URL: import.meta.env.VITE_FETCH_URL ,
  
  // Attendance fetch endpoint
  ATTENDANCE_URL: import.meta.env.VITE_ATTENDANCE_URL ,
  
  // Seating plan fetch endpoint
  SEATING_URL: import.meta.env.VITE_SEATING ,
};

// Semester mapping
export const SEMESTER_MAP = {
  'odd': '1',
  'even': '2', 
  'summer': '3'
};

export const getAcademicYearCode = (academicYear) => {
  const firstYear = parseInt(academicYear.split('-')[0]);
  return (16 + (firstYear - 2024) * 3).toString();
};

// Helper function to generate captcha URL with timestamp
export const getCaptchaUrl = () => {
  return `${API_CONFIG.CAPTCHA_URL}?ts=${Date.now()}`;
};

// Helper function to get form data with common fields (updated for session-based system)
export const getFormData = (username, password, captcha, semester, academicYear, sessionId) => {
  const form = new FormData();
  form.append("username", username);
  form.append("password", password);
  form.append("captcha", captcha);
  form.append("session_id", sessionId || ""); // Always send session_id, even if empty
  form.append("academic_year_code", getAcademicYearCode(academicYear));
  form.append("semester_id", SEMESTER_MAP[semester]);
  return form;
};

// Helper function to get current academic year options
export const getCurrentAcademicYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const options = [];
  
  // Add current year and previous year
  options.push(`${currentYear-1}-${currentYear.toString().slice(-2)}`);
  options.push(`${currentYear}-${(currentYear+1).toString().slice(-2)}`);
  
  return options;
};

// Helper function to get form data for seating plan (no semester/academic year needed)
export const getSeatingFormData = (username, password, captcha, sessionId) => {
  const form = new FormData();
  form.append("username", username);
  form.append("password", password);
  form.append("captcha", captcha);
  form.append("session_id", sessionId || "");
  return form;
};
