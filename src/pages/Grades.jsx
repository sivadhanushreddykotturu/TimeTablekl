import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiShare2 } from "react-icons/fi";
import axios from "axios";
import Header from "../components/Header";
import SemesterPicker from "../components/SemesterPicker";
import Toast from "../components/Toast";
import { getCredentials, handleSessionRefresh } from "../../utils/storage.js";
import {
  API_CONFIG,
  getFormData,
  getMarksDetailFormData,
} from "../config/api.js";
import {
  buildSemesterOptions,
  calculateGPA,
  decodeHtml,
  filterCoursesBySemester,
  formatSemesterLabel,
} from "../utils/gradesUtils.js";
import { trackEvent } from "../utils/analytics";

const MARKS_DETAIL_FIELDS = [
  { key: "internal_marks", label: "Internal Marks" },
  { key: "external_marks", label: "External Marks" },
  { key: "total_marks", label: "Total Marks" },
  { key: "external_labs_status", label: "External Labs Status" },
  { key: "external_labs_marks", label: "External Labs Marks" },
  { key: "external_theory_status", label: "External Theory Status" },
  { key: "external_theory_marks", label: "External Theory Marks" },
];

function getGradeColorHex(grade, course) {
  if (!grade) return "#1a1a1a";
  const g = grade.toUpperCase();
  const credits = parseFloat(course?.credits ?? "");
  const status = (course?.promotion_status ?? "").toUpperCase();
  if (g === "P" && credits === 0 && status === "P") return "#6c757d";
  if (g === "O" || g === "A+") return "#28a745";
  if (g === "A" || g === "B+") return "#5cb85c";
  if (g === "B" || g === "C") return "#ffc107";
  if (g === "P") return "#6c757d";
  return "#dc3545";
}

function getGradeColor(grade, course) {
  if (!grade) return "var(--text-primary)";
  const g = grade.toUpperCase();
  const credits = parseFloat(course?.credits ?? "");
  const status = (course?.promotion_status ?? "").toUpperCase();

  // Pass / non-credit courses (P, 0 credits, promoted) — not a failing grade
  if (g === "P" && credits === 0 && status === "P") {
    return "var(--text-secondary)";
  }

  if (g === "O" || g === "A+") return "#28a745";
  if (g === "A" || g === "B+") return "#5cb85c";
  if (g === "B" || g === "C") return "#ffc107";
  if (g === "P") return "var(--text-secondary)";
  return "#dc3545";
}

export default function Grades() {
  const navigate = useNavigate();
  const location = useLocation();
  const friendCredentials = location.state?.friendCredentials || null;
  const [viewMode, setViewMode] = useState("cgpa");
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [selectedSemesterKey, setSelectedSemesterKey] = useState("");
  const [showMarksModal, setShowMarksModal] = useState(false);
  const [marksLoading, setMarksLoading] = useState(false);
  const [marksDetail, setMarksDetail] = useState(null);
  const [marksCourseLabel, setMarksCourseLabel] = useState("");
  const [exporting, setExporting] = useState(false);

  const semesterOptions = useMemo(() => buildSemesterOptions(courses), [courses]);

  const displayedCourses = useMemo(() => {
    if (viewMode === "sgpa" && selectedSemesterKey) {
      return filterCoursesBySemester(courses, selectedSemesterKey);
    }
    return courses;
  }, [courses, viewMode, selectedSemesterKey]);

  const cgpaValue = useMemo(() => calculateGPA(courses), [courses]);
  const sgpaValue = useMemo(() => calculateGPA(displayedCourses), [displayedCourses]);

  const fetchCgpaData = async () => {
    setIsLoading(true);
    setError("");

    const creds = friendCredentials || getCredentials();
    if (!creds) {
      setError("Session expired. Please log in again.");
      setIsLoading(false);
      return;
    }

    const semester = friendCredentials
      ? friendCredentials.semester
      : localStorage.getItem("semester") || "odd";
    const academicYear = friendCredentials
      ? friendCredentials.academicYear
      : localStorage.getItem("academicYear") || "2024-25";

    try {
      const form = getFormData(
        creds.username,
        creds.password,
        "",
        semester,
        academicYear,
        "",
        { useStoredCookies: !friendCredentials }
      );
      const res = await axios.post(API_CONFIG.CGPA_URL, form);

      if (res.data.success) {
        if (!friendCredentials) {
          handleSessionRefresh(res.data);
        }
        const rows = res.data.data || [];
        setCourses(rows);

        const options = buildSemesterOptions(rows);
        if (options.length > 0) {
          setSelectedSemesterKey(options[0].key);
        }

        trackEvent("cgpa_fetched", {
          course_count: rows.length,
          cgpa: calculateGPA(rows),
          is_friend: !!friendCredentials,
          friend_name: friendCredentials?.name || null,
        });

        setToast({
          show: true,
          message: "Grades fetched successfully!",
          type: "success",
        });
      } else {
        setError(res.data.message || "Failed to fetch grades. Please try again.");
      }
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCgpaData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    trackEvent("grades_page_viewed", { view_mode: viewMode });
  }, [viewMode]);

  const openMarksDetail = async (course) => {
    if (!course.target_href) {
      setToast({
        show: true,
        message: "Detailed marks link not available for this course.",
        type: "error",
      });
      return;
    }

    setMarksCourseLabel(
      `${course.course_code} — ${decodeHtml(course.course_name)}`
    );
    setMarksDetail(null);
    setMarksLoading(true);
    setShowMarksModal(true);

    const creds = friendCredentials || getCredentials();
    if (!creds) {
      setShowMarksModal(false);
      setMarksLoading(false);
      setError("Session expired. Please log in again.");
      return;
    }

    try {
      const form = getMarksDetailFormData(
        creds.username,
        creds.password,
        course.target_href,
        { useStoredCookies: !friendCredentials }
      );
      const res = await axios.post(API_CONFIG.MARKS_DETAIL_URL, form);

      if (!friendCredentials) {
        handleSessionRefresh(res.data);
      }

      if (res.data.success && res.data.scorecard) {
        setMarksDetail(res.data.scorecard);
      } else {
        setShowMarksModal(false);
        setToast({
          show: true,
          message: res.data.message || "Failed to fetch marks details.",
          type: "error",
        });
      }
    } catch (err) {
      setShowMarksModal(false);
      setToast({
        show: true,
        message:
          err.response?.data?.detail ||
            err.response?.data?.message ||
            "Failed to fetch marks details.",
        type: "error",
      });
    } finally {
      setMarksLoading(false);
    }
  };

  const closeMarksModal = () => {
    setShowMarksModal(false);
    setMarksDetail(null);
    setMarksCourseLabel("");
  };

  const headlineGpa = viewMode === "cgpa" ? cgpaValue : sgpaValue;
  const gpaLabel = viewMode === "cgpa" ? "CGPA" : "SGPA";

  const gpaSubtitle = useMemo(() => {
    if (viewMode === "sgpa" && selectedSemesterKey) {
      return semesterOptions.find((o) => o.key === selectedSemesterKey)?.label || "";
    }
    return "All semesters (credit-weighted)";
  }, [viewMode, selectedSemesterKey, semesterOptions]);

  const shareTitle = friendCredentials
    ? `${friendCredentials.name}'s CGPA & SGPA`
    : "CGPA & SGPA";

  const generateHighQualityCanvas = useCallback(() => {
    if (!displayedCourses.length) return null;

    const scale = 2;
    const padding = 40;
    const cardPadding = 16;
    const cardSpacing = 20;
    const headerHeight = 52;
    const statsHeight = 44;
    const metaHeight = 22;
    const gpaBoxHeight = 88;
    const maxWidth = 700;
    const cardWidth = maxWidth - padding * 2;
    const cardBodyHeight = statsHeight + metaHeight;

    let totalHeight = padding * 2 + 50 + gpaBoxHeight + cardSpacing;

    displayedCourses.forEach(() => {
      totalHeight += headerHeight + cardBodyHeight + cardSpacing;
    });
    totalHeight += 36;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = maxWidth * scale;
    canvas.height = totalHeight * scale;
    ctx.scale(scale, scale);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, maxWidth, totalHeight);

    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(shareTitle, maxWidth / 2, 36);

    let yPos = padding + 50;

    const gpaBoxX = padding;
    ctx.fillStyle = "#f0f4ff";
    ctx.fillRect(gpaBoxX, yPos, cardWidth, gpaBoxHeight);
    ctx.strokeStyle = "#667eea";
    ctx.lineWidth = 2;
    ctx.strokeRect(gpaBoxX, yPos, cardWidth, gpaBoxHeight);

    ctx.fillStyle = "#667eea";
    ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(gpaLabel, maxWidth / 2, yPos + 28);

    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 40px system-ui, -apple-system, sans-serif";
    ctx.fillText(headlineGpa ?? "—", maxWidth / 2, yPos + 62);

    ctx.fillStyle = "#666666";
    ctx.font = "500 13px system-ui, -apple-system, sans-serif";
    const subtitleText =
      gpaSubtitle.length > 52 ? `${gpaSubtitle.substring(0, 49)}...` : gpaSubtitle;
    ctx.fillText(subtitleText, maxWidth / 2, yPos + 78);

    yPos += gpaBoxHeight + cardSpacing;

    displayedCourses.forEach((course) => {
      const cardX = padding;
      const cardHeight = headerHeight + cardBodyHeight;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(cardX, yPos, cardWidth, cardHeight);
      ctx.strokeStyle = "#e0e0e0";
      ctx.lineWidth = 1;
      ctx.strokeRect(cardX, yPos, cardWidth, cardHeight);

      ctx.fillStyle = "#667eea";
      ctx.fillRect(cardX, yPos, cardWidth, headerHeight);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      const courseName = decodeHtml(course.course_name);
      const truncatedName =
        courseName.length > 38 ? `${courseName.substring(0, 35)}...` : courseName;
      ctx.fillText(truncatedName, cardX + cardPadding, yPos + headerHeight / 2 + 6);

      ctx.textAlign = "right";
      ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
      ctx.fillText(
        course.grade || "—",
        cardX + cardWidth - cardPadding,
        yPos + headerHeight / 2 + 6
      );

      const bodyY = yPos + headerHeight;
      ctx.fillStyle = "#f8f9fa";
      ctx.fillRect(cardX, bodyY, cardWidth, cardBodyHeight);

      ctx.fillStyle = "#1a1a1a";
      ctx.font = "600 13px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      const statsLine = `GP: ${course.grade_point}   Credits: ${course.credits}   Status: ${course.promotion_status}`;
      ctx.fillText(statsLine, cardX + cardPadding, bodyY + 22);

      ctx.fillStyle = getGradeColorHex(course.grade, course);
      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
      ctx.fillText(`Grade: ${course.grade}`, cardX + cardPadding, bodyY + 40);

      ctx.fillStyle = "#666666";
      ctx.font = "500 12px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(
        `${course.course_code} • ${formatSemesterLabel(course.academic_year, course.semester)}`,
        cardX + cardWidth - cardPadding,
        bodyY + cardBodyHeight - 8
      );

      yPos += cardHeight + cardSpacing;
    });

    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#999999";
    ctx.font = "italic 14px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(gpaLabel, maxWidth - 20, totalHeight - 15);
    ctx.restore();

    return canvas;
  }, [displayedCourses, shareTitle, gpaLabel, headlineGpa, gpaSubtitle]);

  const exportAsImage = useCallback(async () => {
    if (!displayedCourses.length) return;
    setExporting(true);

    try {
      const canvas = generateHighQualityCanvas();
      if (!canvas) {
        alert("Failed to generate image");
        setExporting(false);
        return;
      }

      const prefix = friendCredentials ? `${friendCredentials.name}_` : "";
      const modeLabel = viewMode === "sgpa" ? "SGPA" : "CGPA";
      const fileName = `${prefix}${modeLabel}_${new Date().toISOString().split("T")[0]}.png`;

      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert("Failed to generate image");
          setExporting(false);
          return;
        }

        if (navigator.share && navigator.canShare) {
          try {
            const file = new File([blob], fileName, { type: "image/png" });
            const shareData = {
              files: [file],
              title: `${shareTitle} (${modeLabel})`,
              text: friendCredentials
                ? `Check out ${friendCredentials.name}'s ${modeLabel}!`
                : `Check out my ${modeLabel}!`,
            };

            if (navigator.canShare(shareData)) {
              await navigator.share(shareData);
              trackEvent("grades_shared", { view_mode: viewMode, is_friend: !!friendCredentials });
              setExporting(false);
              return;
            }
          } catch (shareError) {
            if (shareError.name !== "AbortError") {
              console.log("Share failed, falling back to download:", shareError);
            }
          }
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        trackEvent("grades_shared", { view_mode: viewMode, is_friend: !!friendCredentials });
        setExporting(false);
      }, "image/png", 1.0);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. Please try again.");
      setExporting(false);
    }
  }, [displayedCourses, generateHighQualityCanvas, friendCredentials, shareTitle, viewMode]);

  const marksRows = useMemo(() => {
    if (!marksDetail) return [];

    return MARKS_DETAIL_FIELDS.map(({ key, label }) => {
      const value = marksDetail[key];
      if (value === undefined || value === null || value === "") return null;
      return {
        key,
        label,
        value: decodeHtml(String(value)),
      };
    }).filter(Boolean);
  }, [marksDetail]);

  return (
    <>
      <Header />

      <div className="container grades-back-nav">
        <button
          type="button"
          onClick={() => navigate(friendCredentials ? "/maddys" : "/home")}
          className="secondary grades-back-btn"
        >
          {friendCredentials ? "Back to Friends" : "Back to Home"}
        </button>
      </div>

      <div className="container grades-page">
        <div className="page-header">
          <h1 className="page-title">
            {friendCredentials
              ? `${friendCredentials.name}'s CGPA & SGPA`
              : "CGPA & SGPA"}
          </h1>
        </div>

        <div className="grades-view-toggle" role="tablist" aria-label="GPA view">
          <div
            className={`grades-view-toggle-slider${viewMode === "sgpa" ? " is-right" : ""}`}
            aria-hidden
          />
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "cgpa"}
            className={`grades-view-toggle-btn${viewMode === "cgpa" ? " is-active" : ""}`}
            onClick={() => setViewMode("cgpa")}
          >
            CGPA
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "sgpa"}
            className={`grades-view-toggle-btn${viewMode === "sgpa" ? " is-active" : ""}`}
            onClick={() => setViewMode("sgpa")}
          >
            SGPA
          </button>
        </div>

        {viewMode === "sgpa" && semesterOptions.length > 0 && (
          <div className="grades-semester-card">
            <SemesterPicker
              label="Select semester"
              options={semesterOptions}
              value={selectedSemesterKey}
              onChange={setSelectedSemesterKey}
            />
          </div>
        )}

        {isLoading ? (
          <div className="card">
            <p className="text-center">
              <strong>
                Fetching {friendCredentials ? `${friendCredentials.name}'s` : "your"} grades...
              </strong>
            </p>
          </div>
        ) : error ? (
          <div className="card">
            <p className="text-center" style={{ color: "#dc3545", marginBottom: "15px" }}>
              {error}
            </p>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button onClick={fetchCgpaData} className="primary">
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            {headlineGpa !== null && (
              <div className="grades-gpa-hero">
                <span className="grades-gpa-badge">{gpaLabel}</span>
                <div className="grades-gpa-value">{headlineGpa}</div>
                <p className="grades-gpa-subtitle">{gpaSubtitle}</p>
              </div>
            )}

            {displayedCourses.length === 0 ? (
              <div className="card">
                <p className="text-center">No grade data found.</p>
              </div>
            ) : (
              <div className="attendance-container">
                {displayedCourses.map((course, index) => (
                  <div key={`${course.course_code}-${index}`} className="attendance-card">
                    <div className="course-header">
                      <h3 className="course-name">{decodeHtml(course.course_name)}</h3>
                      <span className="course-code">{course.course_code}</span>
                    </div>

                    <div className="grades-stat-grid">
                      <div className="grades-stat-item">
                        <span className="grades-stat-label">Grade</span>
                        <span
                          className="grades-stat-value"
                          style={{ color: getGradeColor(course.grade, course) }}
                        >
                          {course.grade}
                        </span>
                      </div>
                      <div className="grades-stat-item">
                        <span className="grades-stat-label">Grade Point</span>
                        <span className="grades-stat-value">{course.grade_point}</span>
                      </div>
                      <div className="grades-stat-item">
                        <span className="grades-stat-label">Credits</span>
                        <span className="grades-stat-value">{course.credits}</span>
                      </div>
                      <div className="grades-stat-item">
                        <span className="grades-stat-label">Status</span>
                        <span className="grades-stat-value">{course.promotion_status}</span>
                      </div>
                    </div>

                    <p className="grades-course-meta">
                      {formatSemesterLabel(course.academic_year, course.semester)}
                    </p>

                    {course.target_href && (
                      <button
                        type="button"
                        className="grades-more-btn"
                        onClick={() => openMarksDetail(course)}
                      >
                        More details
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {displayedCourses.length > 0 && !isLoading && !error && (
        <button
          type="button"
          className="export-icon-btn"
          onClick={exportAsImage}
          disabled={exporting}
          title={`Share ${gpaLabel}`}
        >
          {exporting ? (
            <span style={{ fontSize: "20px" }}>⏳</span>
          ) : (
            <FiShare2 size={24} />
          )}
        </button>
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />

      {showMarksModal && (
        <div className="modal-overlay" onClick={closeMarksModal}>
          <div className="modal-content register-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Marks Details</h2>
              <button className="close-btn" onClick={closeMarksModal}>
                ×
              </button>
            </div>

            <div className="register-content">
              {marksCourseLabel && (
                <p style={{ marginBottom: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                  {marksCourseLabel}
                </p>
              )}

              {marksLoading ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
                  <div className="loading-spinner" style={{ margin: "0 auto 10px auto" }} />
                  <p>Fetching marks details...</p>
                </div>
              ) : marksDetail ? (
                <div className="attendance-table">
                  {marksRows.map((row) => (
                    <div
                      key={row.key}
                      className="attendance-row"
                      style={{
                        display: "flex",
                        width: "100%",
                        borderBottom: "1px solid var(--border-light)",
                      }}
                    >
                      <span
                        style={{
                          flex: "0 0 45%",
                          padding: "12px 16px",
                          borderRight: "1px solid var(--border-light)",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {row.label}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          padding: "12px 16px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
                  <p>No marks data found.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
