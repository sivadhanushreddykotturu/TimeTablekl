import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { FiShare2 } from "react-icons/fi";
import axios from "axios";
import NeoShell, { NeoModal, NeoLoading } from "../Shell.jsx";
import { NeoSelect } from "../NeoKit.jsx";
import Toast from "../../components/Toast.jsx";
import { getCredentials, handleSessionRefresh } from "../../../utils/storage.js";
import {
  API_CONFIG,
  getFormData,
  getMarksDetailFormData,
} from "../../config/api.js";
import {
  buildSemesterOptions,
  calculateGPA,
  decodeHtml,
  filterCoursesBySemester,
  formatSemesterLabel,
} from "../../utils/gradesUtils.js";
import { trackEvent } from "../../utils/analytics";

const MARKS_DETAIL_FIELDS = [
  { key: "internal_marks", label: "Internal Marks" },
  { key: "external_marks", label: "External Marks" },
  { key: "total_marks", label: "Total Marks" },
  { key: "external_labs_status", label: "External Labs Status" },
  { key: "external_labs_marks", label: "External Labs Marks" },
  { key: "external_theory_status", label: "External Theory Status" },
  { key: "external_theory_marks", label: "External Theory Marks" },
];

function getGradeClass(grade, course) {
  if (!grade) return "";
  const g = grade.toUpperCase();
  const credits = parseFloat(course?.credits ?? "");
  const status = (course?.promotion_status ?? "").toUpperCase();

  if (g === "P" && credits === 0 && status === "P") return "np-dim";
  if (g === "O" || g === "A+" || g === "A" || g === "B+") return "np-good";
  if (g === "B" || g === "C") return "np-warn";
  if (g === "P") return "np-dim";
  return "np-bad";
}

export default function NeoGrades() {
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
    return "all semesters · credit-weighted";
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

    ctx.fillStyle = "#0a0a0c";
    ctx.fillRect(0, 0, maxWidth, totalHeight);

    ctx.fillStyle = "#cfff04";
    ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(shareTitle, maxWidth / 2, 36);

    let yPos = padding + 50;

    const gpaBoxX = padding;
    ctx.fillStyle = "#6533f4";
    ctx.fillRect(gpaBoxX, yPos, cardWidth, gpaBoxHeight);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.strokeRect(gpaBoxX, yPos, cardWidth, gpaBoxHeight);

    ctx.fillStyle = "#cfff04";
    ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(gpaLabel, maxWidth / 2, yPos + 28);

    ctx.fillStyle = "#f4f2ea";
    ctx.font = "bold 40px system-ui, -apple-system, sans-serif";
    ctx.fillText(headlineGpa ?? "—", maxWidth / 2, yPos + 62);

    ctx.fillStyle = "rgba(244,242,234,0.75)";
    ctx.font = "500 13px system-ui, -apple-system, sans-serif";
    const subtitleText =
      gpaSubtitle.length > 52 ? `${gpaSubtitle.substring(0, 49)}...` : gpaSubtitle;
    ctx.fillText(subtitleText, maxWidth / 2, yPos + 78);

    yPos += gpaBoxHeight + cardSpacing;

    displayedCourses.forEach((course) => {
      const cardX = padding;
      const cardHeight = headerHeight + cardBodyHeight;

      ctx.fillStyle = "#131316";
      ctx.fillRect(cardX, yPos, cardWidth, cardHeight);
      ctx.strokeStyle = "#2a2a31";
      ctx.lineWidth = 1;
      ctx.strokeRect(cardX, yPos, cardWidth, cardHeight);

      ctx.fillStyle = "#6533f4";
      ctx.fillRect(cardX, yPos, cardWidth, headerHeight);

      ctx.fillStyle = "#f4f2ea";
      ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      const courseName = decodeHtml(course.course_name);
      const truncatedName =
        courseName.length > 38 ? `${courseName.substring(0, 35)}...` : courseName;
      ctx.fillText(truncatedName, cardX + cardPadding, yPos + headerHeight / 2 + 6);

      ctx.textAlign = "right";
      ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#cfff04";
      ctx.fillText(
        course.grade || "—",
        cardX + cardWidth - cardPadding,
        yPos + headerHeight / 2 + 6
      );

      const bodyY = yPos + headerHeight;
      ctx.fillStyle = "#17171b";
      ctx.fillRect(cardX, bodyY, cardWidth, cardBodyHeight);

      ctx.fillStyle = "#f4f2ea";
      ctx.font = "600 13px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      const statsLine = `GP: ${course.grade_point}   Credits: ${course.credits}   Status: ${course.promotion_status}`;
      ctx.fillText(statsLine, cardX + cardPadding, bodyY + 22);

      ctx.fillStyle = "#8b8b95";
      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
      ctx.fillText(`Grade: ${course.grade}`, cardX + cardPadding, bodyY + 40);

      ctx.fillStyle = "#8b8b95";
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
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#8b8b95";
    ctx.font = "italic 14px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("timetable.", maxWidth - 20, totalHeight - 15);
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
    <NeoShell onRefresh={fetchCgpaData} refreshMode="direct" refreshLabel="refetch">
      <div className="np-pagehead">
        <span className="np-eyebrow">
          {friendCredentials ? `${friendCredentials.name}'s report` : "your report"}
        </span>
        <h1 className="np-pagehead__title">grades<i>.</i></h1>
      </div>

      <div className="np-seg" role="tablist" aria-label="GPA view">
        <div className={`np-seg__slider${viewMode === "sgpa" ? " is-right" : ""}`} aria-hidden />
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === "cgpa"}
          className={`np-seg__btn${viewMode === "cgpa" ? " is-active" : ""}`}
          onClick={() => setViewMode("cgpa")}
        >
          cgpa
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === "sgpa"}
          className={`np-seg__btn${viewMode === "sgpa" ? " is-active" : ""}`}
          onClick={() => setViewMode("sgpa")}
        >
          sgpa
        </button>
      </div>

      {viewMode === "sgpa" && semesterOptions.length > 0 && (
        <NeoSelect
          id="np-sem-picker"
          label="semester"
          value={selectedSemesterKey}
          onChange={(e) => setSelectedSemesterKey(e.target.value)}
        >
          {semesterOptions.map((option) => (
            <option key={option.key} value={option.key}>{option.label}</option>
          ))}
        </NeoSelect>
      )}

      {isLoading ? (
        <NeoLoading text={`fetching ${friendCredentials ? `${friendCredentials.name}'s` : "your"} grades…`} />
      ) : error ? (
        <div className="np-error">
          <p>{error}</p>
          <button onClick={fetchCgpaData} className="np-iconbtn">retry</button>
        </div>
      ) : (
        <>
          {headlineGpa !== null && (
            <div className="np-gpa">
              <span className="np-gpa__badge">{gpaLabel}</span>
              <div className="np-gpa__value">{headlineGpa}</div>
              <p className="np-gpa__sub">{gpaSubtitle}</p>
            </div>
          )}

          {displayedCourses.length === 0 ? (
            <div className="np-empty">
              <h2 className="np-empty__title">no grade data</h2>
              <p className="np-empty__text">Nothing came back from ERP.</p>
            </div>
          ) : (
            displayedCourses.map((course, index) => (
              <div key={`${course.course_code}-${index}`} className="np-att">
                <div className="np-att__head">
                  <div className="np-att__code">{course.course_code}</div>
                  <h3 className="np-att__name">{decodeHtml(course.course_name)}</h3>
                </div>

                <div className="np-grade-grid">
                  <div className="np-stat">
                    <div className="np-stat__label">grade</div>
                    <div className={`np-stat__value ${getGradeClass(course.grade, course)}`}>
                      {course.grade}
                    </div>
                  </div>
                  <div className="np-stat">
                    <div className="np-stat__label">gp</div>
                    <div className="np-stat__value">{course.grade_point}</div>
                  </div>
                  <div className="np-stat">
                    <div className="np-stat__label">credits</div>
                    <div className="np-stat__value">{course.credits}</div>
                  </div>
                  <div className="np-stat">
                    <div className="np-stat__label">status</div>
                    <div className="np-stat__value">{course.promotion_status}</div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid var(--np-line)" }}>
                  <span className="np-note">
                    {formatSemesterLabel(course.academic_year, course.semester)}
                  </span>
                  {course.target_href && (
                    <button
                      type="button"
                      className="np-minibtn"
                      onClick={() => openMarksDetail(course)}
                    >
                      more details
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {displayedCourses.length > 0 && !isLoading && !error && (
        <button
          type="button"
          className="np-fab np-fab--1"
          onClick={exportAsImage}
          disabled={exporting}
          title={`Share ${gpaLabel}`}
        >
          {exporting ? "…" : <FiShare2 size={20} />}
        </button>
      )}

      <NeoModal open={showMarksModal} title="marks details" onClose={closeMarksModal} wide>
        {marksCourseLabel && (
          <p className="np-note" style={{ marginBottom: 12, color: "var(--np-cream)", fontWeight: 700 }}>
            {marksCourseLabel}
          </p>
        )}

        {marksLoading ? (
          <NeoLoading text="fetching marks…" />
        ) : marksDetail ? (
          <div className="np-table">
            {marksRows.map((row) => (
              <div key={row.key} className="np-table__row">
                <span className="np-table__cell" style={{ flex: "0 0 48%", fontWeight: 700 }}>
                  {row.label}
                </span>
                <span className="np-table__cell np-dim">{row.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="np-note">No marks data found.</p>
        )}
      </NeoModal>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
    </NeoShell>
  );
}
