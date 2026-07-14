import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { FiShare2 } from "react-icons/fi";
import { LuCalculator } from "react-icons/lu";
import axios from "axios";
import NeoShell, { NeoModal, NeoLoading } from "../Shell.jsx";
import { NeoButton } from "../NeoKit.jsx";
import CalculatorModal from "../../components/CalculatorModal";
import ShowCalculation from "../../components/ShowCalculation";
import Toast from "../../components/Toast.jsx";
import { trackEvent } from "../../utils/analytics";
import { getCredentials, handleSessionRefresh } from "../../../utils/storage.js";
import { getFormData, getRegisterDetailFormData, API_CONFIG } from "../../config/api.js";

export default function NeoAttendance() {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [calculatorInitialCourse, setCalculatorInitialCourse] = useState(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedRegisterData, setSelectedRegisterData] = useState(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState([]);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [showCalculationModal, setShowCalculationModal] = useState(false);
  const [selectedCourseData, setSelectedCourseData] = useState(null);
  const [exporting, setExporting] = useState(false);

  const friendCredentials = location.state?.friendCredentials || null;
  const [targetPercentage, setTargetPercentage] = useState(() => {
    const saved = localStorage.getItem("attendanceTargetPercentage");
    const parsed = saved ? parseFloat(saved) : NaN;
    return Number.isFinite(parsed) ? parsed : 75;
  });
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [targetError, setTargetError] = useState("");

  useEffect(() => {
    if (showTargetModal) {
      setTargetInput(String(targetPercentage));
      setTargetError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTargetModal]);

  const fetchAttendanceData = async () => {
    setIsLoading(true);
    setError("");

    const creds = friendCredentials || getCredentials();
    if (!creds) {
      setError("Session expired. Please log in again.");
      setIsLoading(false);
      return;
    }

    const semester = friendCredentials ? friendCredentials.semester : (localStorage.getItem("semester") || "odd");
    const academicYear = friendCredentials ? friendCredentials.academicYear : (localStorage.getItem("academicYear") || "2024-25");

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
      const res = await axios.post(API_CONFIG.ATTENDANCE_URL, form);

      if (res.data.success) {
        if (!friendCredentials) {
          handleSessionRefresh(res.data);
        }
        handleAttendanceSuccess(res.data.attendance);
      } else {
        setError(res.data.message || "Failed to fetch attendance. Please try again.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
    // eslint-disable-next-line
  }, []);

  const getField = (item, snake, pascal) => item[snake] ?? item[pascal] ?? "";

  const handleAttendanceSuccess = (attendance) => {
    const grouped = groupAttendanceByCourse(attendance);
    const courseCount = grouped.length;
    const overallPercentages = grouped.map(c => c.overallPercentage);
    const avgPercentage = overallPercentages.length > 0
      ? Math.round(overallPercentages.reduce((a, b) => a + b, 0) / overallPercentages.length)
      : 0;

    trackEvent('attendance_fetched', {
      course_count: courseCount,
      average_percentage: avgPercentage,
      is_friend: !!friendCredentials,
      friend_name: friendCredentials?.name || null
    });

    // Auto-map empty subject names upon attendance fetch
    try {
      if (!friendCredentials) {
        const savedMappings = JSON.parse(localStorage.getItem("subjectMappings") || "{}");
        let madeChanges = false;

        attendance.forEach(item => {
          const code = getField(item, "course_code", "Coursecode");
          const name = getField(item, "course_name", "Coursedesc");
          if (code && name) {
            const match = code.match(/^[A-Za-z0-9]+/);
            const mainCode = match ? match[0] : code;

            if (!savedMappings[mainCode]) {
              const words = name.trim().split(/\s+/);
              let acronym = "";
              if (words.length === 1) {
                acronym = words[0].substring(0, 5).toUpperCase();
              } else {
                words.forEach(word => {
                  if (
                    word.length > 0 &&
                    !["AND", "OF", "THE", "IN", "FOR", "TO"].includes(word.toUpperCase()) &&
                    !word.match(/^[0-9]+$/)
                  ) {
                    acronym += word[0].toUpperCase();
                  }
                });
                acronym = acronym.substring(0, 5);
              }
              if (acronym) {
                savedMappings[mainCode] = acronym;
                madeChanges = true;
              }
            }
          }
        });

        if (madeChanges) {
          localStorage.setItem("subjectMappings", JSON.stringify(savedMappings));
        }
      }
    } catch (err) {
      console.error("Error auto-mapping subjects:", err);
    }

    setAttendanceData(attendance);
    setToast({
      show: true,
      message: "Attendance fetched successfully!",
      type: "success"
    });
  };

  const getPctClass = (percentage) => {
    const num = parseFloat(percentage);
    if (num >= 85) return "np-good";
    if (num >= 75) return "np-warn";
    return "np-bad";
  };

  const saveTargetPercentage = (value) => {
    setTargetPercentage(value);
    try {
      localStorage.setItem("attendanceTargetPercentage", String(value));
    } catch (_) { }
  };

  const classesToReachTarget = (present, total, target) => {
    if (target >= 100) return Infinity;
    const needed = (target * total - 100 * present) / (100 - target);
    return Math.max(0, Math.ceil(needed));
  };

  const safeBunksAtTarget = (present, total, target) => {
    if (target <= 0) return Infinity;
    const available = (100 * present - target * total) / target;
    return Math.max(0, Math.floor(available));
  };

  const groupAttendanceByCourse = (attendance) => {
    const LTPS_WEIGHTS = { L: 100, T: 100, P: 50, S: 25, O: 1 };

    const grouped = {};
    attendance.forEach(item => {
      const courseCode = item.course_code ?? item.Coursecode ?? "";
      const courseName = item.course_name ?? item.Coursedesc ?? "";
      const ltps = item.type ?? item.Ltps ?? "";
      const section = item.section ?? item.Section ?? "";
      const conducted = item.conducted ?? item["Total Conducted"] ?? "0";
      const attended = item.attended ?? item["Total Attended"] ?? "0";
      const absent = item.absent ?? item["Total Absent"] ?? "0";
      const percentage = item.percentage ?? item.Percentage ?? "0";
      const tcbr = parseInt(item.tcbr ?? item.Tcbr ?? "0");

      if (!grouped[courseCode]) {
        grouped[courseCode] = { courseName, courseCode, sections: [] };
      }

      const totalAttended = parseInt(attended);
      const totalConducted = parseInt(conducted);

      let rawPercentage = 0;
      if (totalConducted > 0) {
        const adjustedAttended = totalAttended + (tcbr > 0 ? tcbr : 0);
        rawPercentage = (adjustedAttended / totalConducted) * 100;
      }

      grouped[courseCode].sections.push({
        ltps,
        section,
        percentage,
        totalConducted: conducted,
        totalAttended: attended,
        totalAbsent: absent,
        tcbr,
        rawPercentage: rawPercentage.toFixed(2)
      });
    });

    Object.values(grouped).forEach(course => {
      if (course.sections.length > 0) {
        let weightedAttendedSum = 0;
        let weightedConductedSum = 0;

        course.sections.forEach(section => {
          const componentType = section.ltps.charAt(0).toUpperCase();
          const weight = LTPS_WEIGHTS[componentType] || LTPS_WEIGHTS.O;

          const attended = parseInt(section.totalAttended);
          const conducted = parseInt(section.totalConducted);
          const tcbr = parseInt(section.tcbr || "0");
          const adjustedAttended = (Number.isFinite(attended) ? attended : 0) + (tcbr > 0 ? tcbr : 0);
          const safeConducted = Number.isFinite(conducted) ? conducted : 0;

          weightedAttendedSum += adjustedAttended * weight;
          weightedConductedSum += safeConducted * weight;
        });

        if (weightedConductedSum > 0) {
          const calculated = (weightedAttendedSum / weightedConductedSum) * 100;
          course.overallPercentage = Math.ceil(Math.max(0, Math.min(100, calculated)));
        } else {
          course.overallPercentage = 0;
        }

        course.averageType = "Weighted (L/T/P/S)";
      } else {
        course.overallPercentage = 0;
        course.averageType = "N/A";
      }
    });

    return Object.values(grouped);
  };

  const generateHighQualityCanvas = useCallback(() => {
    if (!attendanceData || attendanceData.length === 0) return null;

    const groupedCourses = groupAttendanceByCourse(attendanceData);
    if (groupedCourses.length === 0) return null;

    const scale = 2;
    const padding = 40;
    const cardPadding = 16;
    const cardSpacing = 20;
    const headerHeight = 50;
    const componentRowHeight = 40;
    const componentIndent = 20;
    const maxWidth = 700;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let totalHeight = padding * 2 + 60;

    groupedCourses.forEach(course => {
      totalHeight += headerHeight;
      const components = ['L', 'T', 'P', 'S'];
      let componentCount = 0;
      components.forEach(comp => {
        const section = course.sections.find(s => s.ltps.charAt(0).toUpperCase() === comp);
        if (section) componentCount++;
      });
      totalHeight += componentCount * componentRowHeight;
      totalHeight += cardSpacing;
    });

    totalHeight += 40;

    canvas.width = maxWidth * scale;
    canvas.height = totalHeight * scale;
    ctx.scale(scale, scale);

    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, maxWidth, totalHeight);

    ctx.fillStyle = '#cfff04';
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    const titleText = friendCredentials ? `${friendCredentials.name}'s Attendance` : 'Attendance';
    ctx.fillText(titleText, maxWidth / 2, 35);

    let yPos = padding + 60;

    groupedCourses.forEach((course) => {
      const cardX = padding;
      const cardWidth = maxWidth - (padding * 2);

      const components = ['L', 'T', 'P', 'S'];
      let componentCount = 0;
      components.forEach(comp => {
        const section = course.sections.find(s => s.ltps.charAt(0).toUpperCase() === comp);
        if (section) componentCount++;
      });
      const cardHeight = headerHeight + (componentCount * componentRowHeight);

      ctx.fillStyle = '#131316';
      ctx.fillRect(cardX, yPos, cardWidth, cardHeight);
      ctx.strokeStyle = '#2a2a31';
      ctx.lineWidth = 1;
      ctx.strokeRect(cardX, yPos, cardWidth, cardHeight);

      ctx.fillStyle = '#6533f4';
      ctx.fillRect(cardX, yPos, cardWidth, headerHeight);
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(cardX, yPos, cardWidth, headerHeight);

      ctx.fillStyle = '#f4f2ea';
      ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      const courseName = course.courseName.length > 45
        ? course.courseName.substring(0, 42) + '...'
        : course.courseName;
      ctx.fillText(courseName, cardX + cardPadding, yPos + headerHeight / 2 + 6);

      ctx.fillStyle = '#cfff04';
      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${course.overallPercentage}%`, cardX + cardWidth - cardPadding, yPos + headerHeight / 2 + 6);

      let componentY = yPos + headerHeight;

      components.forEach((comp, compIndex) => {
        const section = course.sections.find(s => s.ltps.charAt(0).toUpperCase() === comp);
        if (section) {
          const attended = parseInt(section.totalAttended);
          const conducted = parseInt(section.totalConducted);
          const tcbr = parseInt(section.tcbr || "0");
          const adjustedAttended = (Number.isFinite(attended) ? attended : 0) + (tcbr > 0 ? tcbr : 0);
          const safeConducted = Number.isFinite(conducted) ? conducted : 0;

          let individualPercentage = 0;
          if (safeConducted > 0) {
            individualPercentage = Math.ceil((adjustedAttended / safeConducted) * 100);
          }

          ctx.fillStyle = compIndex % 2 === 0 ? '#131316' : '#17171b';
          ctx.fillRect(cardX, componentY, cardWidth, componentRowHeight);

          ctx.fillStyle = '#6533f4';
          ctx.fillRect(cardX + cardPadding, componentY + 8, 32, 24);
          ctx.fillStyle = '#f4f2ea';
          ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(comp, cardX + cardPadding + 16, componentY + 24);

          ctx.fillStyle = '#f4f2ea';
          ctx.font = '600 14px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(`${individualPercentage}%`, cardX + cardPadding + componentIndent + 32, componentY + componentRowHeight / 2 + 5);

          componentY += componentRowHeight;
        }
      });

      ctx.strokeStyle = '#2a2a31';
      ctx.strokeRect(cardX, yPos, cardWidth, cardHeight);

      yPos += cardHeight + cardSpacing;
    });

    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#8b8b95';
    ctx.font = 'italic 14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('timetable.', maxWidth - 20, totalHeight - 15);
    ctx.restore();

    return canvas;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceData, friendCredentials]);

  const exportAsImage = useCallback(async () => {
    if (!attendanceData || attendanceData.length === 0) return;
    setExporting(true);

    try {
      const canvas = generateHighQualityCanvas();
      if (!canvas) {
        alert('Failed to generate image');
        setExporting(false);
        return;
      }

      const fileName = friendCredentials
        ? `${friendCredentials.name}_Attendance_${new Date().toISOString().split('T')[0]}.png`
        : `Attendance_${new Date().toISOString().split('T')[0]}.png`;

      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert('Failed to generate image');
          setExporting(false);
          return;
        }

        if (navigator.share && navigator.canShare) {
          try {
            const file = new File([blob], fileName, { type: 'image/png' });
            const shareData = {
              files: [file],
              title: friendCredentials ? `${friendCredentials.name}'s Attendance` : 'My Attendance',
              text: friendCredentials ? `Check out ${friendCredentials.name}'s attendance!` : 'Check out my attendance!'
            };

            if (navigator.canShare(shareData)) {
              await navigator.share(shareData);
              setExporting(false);
              return;
            }
          } catch (shareError) {
            if (shareError.name !== 'AbortError') {
              console.log('Share failed, falling back to download:', shareError);
            }
          }
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        setExporting(false);
      }, 'image/png', 1.0);

    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
      setExporting(false);
    }
  }, [attendanceData, generateHighQualityCanvas, friendCredentials]);

  useEffect(() => {
    trackEvent('attendance_page_viewed', {
      has_attendance_data: attendanceData.length > 0,
      is_friend: !!friendCredentials,
      friend_name: friendCredentials?.name || null
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegisterFetch = async (course, section) => {
    const attendanceItem = attendanceData.find(item => {
      const iCode = item.course_code ?? item.Coursecode ?? "";
      const iLtps = item.type ?? item.Ltps ?? "";
      const iSect = item.section ?? item.Section ?? "";
      return (
        iCode === course.courseCode &&
        iLtps === section.ltps &&
        iSect === section.section
      );
    });

    if (!attendanceItem) return;

    if (attendanceItem.register_href) {
      setRegisterLoading(true);
      setSelectedRegisterData(null);
      setShowRegisterModal(true);

      try {
        const creds = friendCredentials || getCredentials();
        if (!creds) {
          setRegisterLoading(false);
          setShowRegisterModal(false);
          setError("Session expired. Please log in again.");
          return;
        }

        const form = getRegisterDetailFormData(
          creds.username,
          creds.password,
          attendanceItem.register_href,
          { useStoredCookies: !friendCredentials }
        );
        const res = await axios.post(API_CONFIG.REGISTER_DETAIL_URL, form);

        if (!friendCredentials) {
          handleSessionRefresh(res.data);
        }

        if (res.data.success) {
          setSelectedRegisterData({
            metadata: {
              ...res.data.metadata,
              Coursecode: attendanceItem.course_code ?? attendanceItem.Coursecode,
              Ltps: attendanceItem.type ?? attendanceItem.Ltps,
              Section: attendanceItem.section ?? attendanceItem.Section
            },
            daily_attendance: res.data.daily_attendance
          });
        } else {
          setShowRegisterModal(false);
          setToast({ show: true, message: res.data.message || "Failed to fetch register.", type: "error" });
        }
      } catch (err) {
        console.error("Register detail fetch error:", err);
        setShowRegisterModal(false);
        setToast({ show: true, message: "Failed to fetch register details.", type: "error" });
      } finally {
        setRegisterLoading(false);
      }
    } else {
      setSelectedRegisterData({
        metadata: {
          Coursecode: attendanceItem.course_code ?? attendanceItem.Coursecode,
          Coursedesc: attendanceItem.course_name ?? attendanceItem.Coursedesc,
          Ltps: attendanceItem.type ?? attendanceItem.Ltps,
          Section: attendanceItem.section ?? attendanceItem.Section,
          "Total Conducted": attendanceItem.conducted ?? attendanceItem["Total Conducted"],
          "Total Attended": attendanceItem.attended ?? attendanceItem["Total Attended"],
          "Total Absent": attendanceItem.absent ?? attendanceItem["Total Absent"],
          Percentage: attendanceItem.percentage ?? attendanceItem.Percentage
        },
        daily_attendance: []
      });
      setShowRegisterModal(true);
    }
  };

  const closeRegisterModal = () => {
    setShowRegisterModal(false);
    setSelectedRegisterData(null);
  };

  return (
    <NeoShell onRefresh={fetchAttendanceData} refreshMode="direct" refreshLabel="refetch">
      <div className="np-pagehead">
        <span className="np-eyebrow">
          {friendCredentials ? `${friendCredentials.name}'s numbers` : "your numbers"}
        </span>
        <div className="np-pagehead__row">
          <h1 className="np-pagehead__title">attendance<i>.</i></h1>
          <button className="np-iconbtn" onClick={() => setShowTargetModal(true)}>
            safe % · {targetPercentage}
          </button>
        </div>
      </div>

      {isLoading ? (
        <NeoLoading text={`fetching ${friendCredentials ? `${friendCredentials.name}'s` : "your"} attendance…`} />
      ) : error ? (
        <div className="np-error">
          <p>{error}</p>
          <button onClick={fetchAttendanceData} className="np-iconbtn">retry</button>
        </div>
      ) : attendanceData.length === 0 ? (
        <div className="np-empty">
          <h2 className="np-empty__title">no attendance data</h2>
          <p className="np-empty__text">Nothing came back from ERP for this semester.</p>
        </div>
      ) : (
        groupAttendanceByCourse(attendanceData).map((course, index) => (
          <div key={index} className="np-att">
            <div className="np-att__head">
              <div className="np-att__code">{course.courseCode}</div>
              <h3 className="np-att__name">{course.courseName}</h3>
            </div>

            <div className="np-att__total">
              <div>
                <div className="np-panel__label" style={{ marginBottom: 4 }}>overall</div>
                <div className="np-att__total-meta">
                  {course.averageType || "Weighted"} · {course.sections.length} component{course.sections.length !== 1 ? "s" : ""}
                </div>
                <div className="np-att__tools">
                  <button
                    className="np-minibtn"
                    onClick={() => {
                      const initData = course.sections.map(section => {
                        const type = section.ltps.charAt(0).toUpperCase();
                        return {
                          type,
                          attended: section.totalAttended,
                          conducted: section.totalConducted,
                          tcbr: section.tcbr || "0"
                        };
                      }).filter(item => ['L', 'T', 'P', 'S'].includes(item.type));
                      setCalculatorInitialCourse(initData);
                      setShowCalculatorModal(true);
                    }}
                  >
                    calculator
                  </button>
                  <button
                    className="np-minibtn"
                    onClick={() => {
                      setSelectedCourseData(course);
                      setShowCalculationModal(true);
                    }}
                  >
                    breakdown
                  </button>
                </div>
              </div>
              <div className={`np-att__total-pct ${getPctClass(course.overallPercentage)}`}>
                {course.overallPercentage}%
              </div>
            </div>

            {course.sections.map((section, sectionIndex) => {
              const attended = parseInt(section.totalAttended);
              const conducted = parseInt(section.totalConducted);
              const tcbr = parseInt(section.tcbr || "0");
              const adjustedAttended = (Number.isFinite(attended) ? attended : 0) + (tcbr > 0 ? tcbr : 0);
              const hasNums = Number.isFinite(attended) && Number.isFinite(conducted) && conducted > 0;
              const currentPct = hasNums ? (adjustedAttended / conducted) * 100 : 0;

              return (
                <div key={sectionIndex} className="np-att__section">
                  <span className="np-att__ltps">{section.ltps}</span>
                  <div className="np-att__section-info">
                    <div className="np-att__section-name">{section.section}</div>
                    {["L", "P", "S", "T"].includes(section.ltps.charAt(0).toUpperCase()) && (
                      <button
                        className="np-minibtn"
                        onClick={() => handleRegisterFetch(course, section)}
                      >
                        register
                      </button>
                    )}
                  </div>
                  <div className="np-att__nums">
                    <div className={`np-att__pct ${getPctClass(section.rawPercentage)}`}>
                      {Math.ceil(parseFloat(section.rawPercentage))}%{" "}
                      {section.totalConducted > 0 && section.rawPercentage && (
                        <small>({section.rawPercentage}%)</small>
                      )}
                    </div>
                    <div className="np-att__detail">
                      {section.totalAttended}/{section.totalConducted} · {section.totalAbsent} absent
                      {tcbr > 0 ? ` · tcbr ${tcbr}` : ""}
                    </div>
                    {hasNums && (
                      currentPct >= targetPercentage ? (
                        <div className="np-att__hint">
                          safe bunks at {targetPercentage}%: <b>{safeBunksAtTarget(adjustedAttended, conducted, targetPercentage)} hrs</b>
                        </div>
                      ) : (
                        <div className="np-att__hint">
                          attend <b>{classesToReachTarget(adjustedAttended, conducted, targetPercentage)} hrs</b> for {targetPercentage}%
                        </div>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}

      <CalculatorModal
        isOpen={showCalculatorModal}
        onClose={() => {
          setShowCalculatorModal(false);
          setCalculatorInitialCourse(null);
        }}
        initialCourseData={calculatorInitialCourse}
      />

      <ShowCalculation
        isOpen={showCalculationModal}
        onClose={() => {
          setShowCalculationModal(false);
          setSelectedCourseData(null);
        }}
        courseData={selectedCourseData}
      />

      {attendanceData.length > 0 && (
        <button
          className="np-fab np-fab--2"
          onClick={exportAsImage}
          disabled={exporting}
          title="Share attendance"
        >
          {exporting ? "…" : <FiShare2 size={20} />}
        </button>
      )}

      <button
        className="np-fab np-fab--1"
        onClick={() => {
          setCalculatorInitialCourse(null);
          setShowCalculatorModal(true);
        }}
        title="Open calculator"
      >
        <LuCalculator size={20} />
      </button>

      {/* register details */}
      <NeoModal open={showRegisterModal} title="register details" onClose={closeRegisterModal} wide>
        {registerLoading ? (
          <NeoLoading text="fetching register…" />
        ) : selectedRegisterData ? (
          <div className="np-table">
            <div className="np-table__row is-head">
              <span className="np-table__cell" style={{ flex: "0 0 60%" }}>date & time</span>
              <span className="np-table__cell" style={{ textAlign: "center" }}>status</span>
            </div>
            {selectedRegisterData.daily_attendance && selectedRegisterData.daily_attendance.length > 0 ? (
              [...selectedRegisterData.daily_attendance].reverse().map((entry, index) => (
                <div key={index} className="np-table__row">
                  <span className="np-table__cell" style={{ flex: "0 0 60%" }}>
                    {entry.date_slot.split(' H ')[0]} H{entry.date_slot.split(' H ')[1]}
                  </span>
                  <span
                    className={`np-table__cell ${entry.status === 'P' ? "np-good" : "np-bad"}`}
                    style={{ textAlign: "center", fontWeight: 700 }}
                  >
                    {entry.status === 'P' ? 'Present' : 'Absent'}
                  </span>
                </div>
              ))
            ) : (
              <div className="np-table__row">
                <span className="np-table__cell np-dim">No daily attendance data available</span>
              </div>
            )}
          </div>
        ) : (
          <p className="np-note">No register data found.</p>
        )}
      </NeoModal>

      {/* safe % target */}
      <NeoModal open={showTargetModal} title="edit safe percentage" onClose={() => setShowTargetModal(false)}>
        <div className="np-field">
          <div className="np-field__head">
            <label className="np-field__label" htmlFor="np-target">target % (0–100)</label>
          </div>
          <input
            id="np-target"
            className="np-field__input"
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            step="0.1"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
          />
        </div>
        {targetError && <p className="np-note np-bad" style={{ marginBottom: 12 }}>{targetError}</p>}
        <NeoButton
          type="button"
          onClick={() => {
            const num = parseFloat((targetInput || "").trim());
            if (!Number.isFinite(num) || num < 0 || num > 100) {
              setTargetError("Enter a number between 0 and 100.");
              return;
            }
            saveTargetPercentage(Math.round(num * 100) / 100);
            setShowTargetModal(false);
          }}
        >
          save target
        </NeoButton>
      </NeoModal>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </NeoShell>
  );
}
