// Helper to extract main course code
function extractMainCode(code) {
  if (!code) return "";
  // Match alphanumeric code at the start (e.g., 24AD01HF)
  const match = code.match(/^[A-Za-z0-9]+/);
  return match ? match[0] : code;
}

// Utility function to get mapped subject name from course code
export const getSubjectName = (courseCode) => {
  if (!courseCode || courseCode === "-") return courseCode;
  const mainCode = extractMainCode(courseCode);
  const subjectMappings = JSON.parse(localStorage.getItem("subjectMappings") || "{}");
  return subjectMappings[mainCode] || mainCode;
};

// Function to get today's unique subjects (deduplicated by main course code)
export const getTodaySubjects = () => {
  const timetable = JSON.parse(localStorage.getItem("timetable") || "{}");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = days[new Date().getDay()];
  const slots = timetable?.[today] || {};
  const uniqueMainCodes = new Set();
  Object.values(slots).forEach(code => {
    if (code && code !== "-") {
      const mainCode = extractMainCode(code);
      uniqueMainCodes.add(mainCode);
    }
  });
  return Array.from(uniqueMainCodes).map(mainCode => ({
    code: mainCode,
    displayName: getSubjectName(mainCode)
  }));
}; 