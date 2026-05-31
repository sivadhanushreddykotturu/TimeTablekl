/** Decode HTML entities from ERP course names (e.g. &amp; → &) */
export const decodeHtml = (text) => {
  if (!text) return "";
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
};

/**
 * SGPA / CGPA: Σ(grade_point × credits) / Σ(credits)
 * Skips rows with zero or invalid credits (audit / non-credit courses).
 */
export const calculateGPA = (courses) => {
  if (!courses?.length) return null;

  let totalPoints = 0;
  let totalCredits = 0;

  courses.forEach((course) => {
    const credits = parseFloat(course.credits);
    const gradePoint = parseFloat(course.grade_point);
    if (!Number.isFinite(credits) || credits <= 0) return;
    if (!Number.isFinite(gradePoint)) return;
    totalPoints += gradePoint * credits;
    totalCredits += credits;
  });

  if (totalCredits <= 0) return null;
  return (totalPoints / totalCredits).toFixed(2);
};

export const getSemesterKey = (course) =>
  `${course.academic_year || ""}|${course.semester || ""}`;

/** Human-readable term name (Odd / Even / Summer / Term 3) for SGPA labels & cards */
export const formatSemesterDisplay = (semester) => {
  const raw = (semester || "").trim();
  if (!raw) return "Unknown Term";

  const lower = raw.toLowerCase();
  if (lower.includes("summer")) return "Summer Term";
  if (lower.includes("odd")) return "Odd Term";
  if (lower.includes("even")) return "Even Term";
  if (/term\s*3|term3/i.test(lower)) return "Term 3";

  return raw.replace(/\bSem\b/i, "Term");
};

export const formatSemesterLabel = (academicYear, semester) =>
  `${academicYear} • ${formatSemesterDisplay(semester)}`;

const getSemesterSortIndex = (semester) => {
  const lower = (semester || "").toLowerCase();
  if (lower.includes("odd")) return 0;
  if (lower.includes("even")) return 1;
  if (lower.includes("summer")) return 2;
  if (/term\s*3|term3/i.test(lower)) return 3;
  return 50;
};

export const buildSemesterOptions = (courses) => {
  const seen = new Map();
  courses.forEach((course) => {
    const key = getSemesterKey(course);
    if (!seen.has(key)) {
      seen.set(key, {
        key,
        academicYear: course.academic_year,
        semester: course.semester,
        label: formatSemesterLabel(course.academic_year, course.semester),
      });
    }
  });

  return Array.from(seen.values()).sort((a, b) => {
    if (a.academicYear !== b.academicYear) {
      return (b.academicYear || "").localeCompare(a.academicYear || "");
    }
    return getSemesterSortIndex(a.semester) - getSemesterSortIndex(b.semester);
  });
};

export const filterCoursesBySemester = (courses, semesterKey) =>
  courses.filter((course) => getSemesterKey(course) === semesterKey);
