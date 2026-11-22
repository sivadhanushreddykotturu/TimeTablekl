import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { MdCalculate, MdChevronRight, MdIosShare } from "react-icons/md";
import axios from "axios";
import NeoShell, { NeoModal, NeoLoading } from "../Shell.jsx";
import { NeoButton } from "../NeoKit.jsx";
import BunkSimulatorModal from "../../components/BunkSimulatorModal";
import CalculatorModal from "../../components/CalculatorModal";
import BunkModeSwitch from "../../components/BunkModeSwitch";
import ShowCalculation from "../../components/ShowCalculation";
import Toast from "../../components/Toast.jsx";
import { trackEvent } from "../../utils/analytics";
import { getCredentials, handleSessionRefresh } from "../../../utils/storage.js";
import { getFormData, getRegisterDetailFormData, API_CONFIG } from "../../config/api.js";
import { getSubjectName } from "../../utils/subjectMapper";
import { getCSSColor } from "../utils/cssColor";
import GuestAuthModal from "../../components/GuestAuthModal.jsx";
import { decodeHtml } from "../../utils/gradesUtils.js";


function formatTimeAgo(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) return `today at ${timeStr}`;
  if (isYesterday) return `yesterday at ${timeStr}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
}

const COMPONENT_NAMES = { L: "Lecture", T: "Tutorial", P: "Practical", S: "Skill" };
const SMALL_WORDS = new Set(["and", "of", "the", "in", "for", "to", "with", "a", "an", "on"]);

/** "PROBABILITY AND STATISTICS" → "Probability and Statistics" */
function titleCase(text) {
  return (text || "")
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) =>
      index > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

export default function NeoAttendance() {
  const location = useLocation();
  const friendCredentials = location.state?.friendCredentials || null;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);
  const [simulatorCourseCode, setSimulatorCourseCode] = useState("");
  const [calculatorInitialCourse, setCalculatorInitialCourse] = useState(null);
  // "new" = tap-to-skip simulator, "old" = the original attendance calculator. Remembered per device.
  const [bunkMode, setBunkModeState] = useState(() => {
    try { return localStorage.getItem("bunkCalcMode") === "old" ? "old" : "new"; } catch { return "new"; }
  });
  const setBunkMode = (m) => {
    setBunkModeState(m);
    try { localStorage.setItem("bunkCalcMode", m); } catch { /* storage unavailable */ }
  };
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedRegisterData, setSelectedRegisterData] = useState(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerLoadingText, setRegisterLoadingText] = useState("fetching register…");
  const [attendanceData, setAttendanceData] = useState(() => {
    if (friendCredentials) return [];
    try {
      const saved = localStorage.getItem("cached_attendance");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [lastFetchedTime, setLastFetchedTime] = useState(() => {
    if (friendCredentials) return null;
    return localStorage.getItem("cached_attendance_time") || null;
  });
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [showCalculationModal, setShowCalculationModal] = useState(false);
  const [selectedCourseData, setSelectedCourseData] = useState(null);
  const [exporting, setExporting] = useState(false);

  const [targetPercentage, setTargetPercentage] = useState(() => {
    const saved = localStorage.getItem("attendanceTargetPercentage");
    const parsed = saved ? parseFloat(saved) : NaN;
    return Number.isFinite(parsed) ? parsed : 85;
  });
  const [includeTcbr, setIncludeTcbr] = useState(true);

  // Ensure legacy stored setting is removed so TCBR always defaults to true
  useEffect(() => {
    try {
      localStorage.removeItem("include_tcbr");
    } catch { /* storage unavailable */ }
  }, []);

  const hasAnyTcbr = attendanceData && attendanceData.length > 0 && attendanceData.some(item => {
    const val = parseInt(item.tcbr ?? item.Tcbr ?? "0", 10);
    return Number.isFinite(val) && val > 0;
  });

  const toggleTcbr = () => {
    setIncludeTcbr((prev) => {
      const next = !prev;
      trackEvent("attendance_tcbr_toggled", { enabled: next });
      return next;
    });
  };
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [targetError, setTargetError] = useState("");
  const [showGuestModal, setShowGuestModal] = useState(false);

  useEffect(() => {
    if (!friendCredentials && !getCredentials()) {
      setShowGuestModal(true);
    }
  }, [friendCredentials]);


  useEffect(() => {
    if (showTargetModal) {
      setTargetInput(String(targetPercentage));
      setTargetError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTargetModal]);

  const [autoSyncing, setAutoSyncing] = useState(false);
  const isFetchingRef = useRef(false);
  const fetchPromiseRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const getField = (item, snake, pascal) => item[snake] ?? item[pascal] ?? "";

  const handleAttendanceSuccess = useCallback((attendance, isBackground = false) => {
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

    // Auto-map empty subject names upon attendance fetch — runs for your own
    // and friends' fetches alike, since nicknames are shared (matching codes
    // get the same shortcut as on the main timetable).
    try {
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
                  !word.match(/^[0-9]+$/) &&
                  /^[A-Za-z0-9]/.test(word)
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
    } catch (err) {
      console.error("Error auto-mapping subjects:", err);
    }

    if (!isMountedRef.current) return;
    setAttendanceData(attendance);
    if (!friendCredentials) {
      const nowIso = new Date().toISOString();
      try {
        localStorage.setItem("cached_attendance", JSON.stringify(attendance));
        localStorage.setItem("cached_attendance_time", nowIso);
      } catch {
        /* ignore storage write error */
      }
      setLastFetchedTime(nowIso);
    }
  }, [friendCredentials]);

  const fetchAttendanceData = useCallback(async (opts = {}) => {
    if (fetchPromiseRef.current) {
      return fetchPromiseRef.current;
    }

    const isBackground = Boolean(opts && opts.isBackground === true);

    const creds = friendCredentials || getCredentials();
    if (!creds) {
      if (!isBackground) {
        setError("Session expired. Please log in again.");
      }
      return false;
    }

    isFetchingRef.current = true;
    if (isBackground) {
      setAutoSyncing(true);
    } else {
      setIsLoading(true);
      setError("");
    }

    const semester = friendCredentials ? friendCredentials.semester : (localStorage.getItem("semester") || "odd");
    const academicYear = friendCredentials ? friendCredentials.academicYear : (localStorage.getItem("academicYear") || "2024-25");

    const doFetch = async () => {
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

        if (!isMountedRef.current) return false;

        if (res.data.success) {
          if (!friendCredentials) {
            handleSessionRefresh(res.data);
          }
          handleAttendanceSuccess(res.data.attendance, isBackground);
          return true;
        } else {
          if (!isBackground) {
            setError(res.data.message || "Failed to fetch attendance. Please try again.");
          }
          return false;
        }
      } catch (err) {
        if (!isMountedRef.current) return false;
        if (!isBackground) {
          setError(err.response?.data?.message || "Something went wrong. Please try again.");
        } else {
          console.warn("Background attendance sync failed:", err);
        }
        return false;
      } finally {
        isFetchingRef.current = false;
        fetchPromiseRef.current = null;
        if (isMountedRef.current) {
          if (isBackground) {
            setAutoSyncing(false);
          } else {
            setIsLoading(false);
          }
        }
      }
    };

    fetchPromiseRef.current = doFetch();
    return fetchPromiseRef.current;
  }, [friendCredentials, handleAttendanceSuccess]);

  const checkAndFetchAttendance = useCallback(() => {
    if (friendCredentials) {
      fetchAttendanceData();
      return;
    }

    const cached = localStorage.getItem("cached_attendance");
    const cachedTime = localStorage.getItem("cached_attendance_time");
    let hasValidCache = false;

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          hasValidCache = true;
        }
      } catch {
        /* ignore storage parse error */
      }
    }

    if (!hasValidCache) {
      // First visit or cache cleared: show loading spinner and fetch
      fetchAttendanceData();
      return;
    }

    // Cache exists: check if fetched within 1 minute
    const now = Date.now();
    const lastFetchMs = cachedTime ? new Date(cachedTime).getTime() : 0;
    const diffMs = now - lastFetchMs;
    const ONE_MINUTE_MS = 60 * 1000;

    if (diffMs >= 0 && diffMs < ONE_MINUTE_MS) {
      // Within 1 minute: do not refetch, save backend request
      return;
    }

    // After 1 minute (or missing timestamp): fetch in background while displaying cached data
    fetchAttendanceData({ isBackground: true });
  }, [friendCredentials, fetchAttendanceData]);

  useEffect(() => {
    checkAndFetchAttendance();
  }, [checkAndFetchAttendance]);

  useEffect(() => {
    const handleTabRefresh = () => {
      checkAndFetchAttendance();
    };
    window.addEventListener("refresh_attendance_tab", handleTabRefresh);
    return () => window.removeEventListener("refresh_attendance_tab", handleTabRefresh);
  }, [checkAndFetchAttendance]);

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
    } catch { /* storage unavailable */ }
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

  const groupAttendanceByCourse = (attendance, withTcbr = includeTcbr) => {
    const LTPS_WEIGHTS = { L: 100, T: 100, P: 50, S: 25, O: 1 };

    const grouped = {};
    attendance.forEach(item => {
      const courseCode = item.course_code ?? item.Coursecode ?? "";
      const courseName = decodeHtml(item.course_name ?? item.Coursedesc ?? "");
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
      const effectiveTcbr = withTcbr ? (tcbr > 0 ? tcbr : 0) : 0;
      const effectiveConducted = withTcbr ? Math.max(0, totalConducted - effectiveTcbr) : totalConducted;
      if (effectiveConducted > 0) {
        rawPercentage = (totalAttended / effectiveConducted) * 100;
      }

      grouped[courseCode].sections.push({
        ltps,
        section,
        percentage,
        totalConducted: conducted,
        totalAttended: attended,
        totalAbsent: absent,
        tcbr,
        effectiveTcbr,
        effectiveConducted,
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

          const attended = parseInt(section.totalAttended, 10);
          const conducted = parseInt(section.totalConducted, 10);
          const tcbr = parseInt(section.tcbr || "0", 10);
          const effectiveTcbr = withTcbr ? (tcbr > 0 ? tcbr : 0) : 0;
          const effectiveConducted = withTcbr ? Math.max(0, conducted - effectiveTcbr) : conducted;
          const safeAttended = Number.isFinite(attended) ? attended : 0;

          weightedAttendedSum += safeAttended * weight;
          weightedConductedSum += effectiveConducted * weight;
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

    const groupedCourses = groupAttendanceByCourse(attendanceData, includeTcbr);
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

    ctx.fillStyle = getCSSColor("--np-void");
    ctx.fillRect(0, 0, maxWidth, totalHeight);

    ctx.fillStyle = getCSSColor("--np-acid");
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

      ctx.fillStyle = getCSSColor("--np-carbon");
      ctx.fillRect(cardX, yPos, cardWidth, cardHeight);
      ctx.strokeStyle = getCSSColor("--np-line");
      ctx.lineWidth = 1;
      ctx.strokeRect(cardX, yPos, cardWidth, cardHeight);

      ctx.fillStyle = getCSSColor("--np-purple");
      ctx.fillRect(cardX, yPos, cardWidth, headerHeight);
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(cardX, yPos, cardWidth, headerHeight);

      ctx.fillStyle = getCSSColor("--np-cream");
      ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      const courseName = course.courseName.length > 45
        ? course.courseName.substring(0, 42) + '...'
        : course.courseName;
      ctx.fillText(courseName, cardX + cardPadding, yPos + headerHeight / 2 + 6);

      ctx.fillStyle = getCSSColor("--np-acid");
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
          const effectiveTcbr = includeTcbr ? (tcbr > 0 ? tcbr : 0) : 0;
          const effectiveConducted = includeTcbr ? Math.max(0, conducted - effectiveTcbr) : conducted;
          const safeAttended = Number.isFinite(attended) ? attended : 0;

          let individualPercentage = 0;
          if (effectiveConducted > 0) {
            individualPercentage = Math.ceil((safeAttended / effectiveConducted) * 100);
          }

          ctx.fillStyle = compIndex % 2 === 0 ? getCSSColor("--np-carbon") : getCSSColor("--np-panel");
          ctx.fillRect(cardX, componentY, cardWidth, componentRowHeight);

          ctx.fillStyle = getCSSColor("--np-purple");
          ctx.fillRect(cardX + cardPadding, componentY + 8, 32, 24);
          ctx.fillStyle = getCSSColor("--np-cream");
          ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(comp, cardX + cardPadding + 16, componentY + 24);

          ctx.fillStyle = getCSSColor("--np-cream");
          ctx.font = '600 14px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(`${individualPercentage}%`, cardX + cardPadding + componentIndent + 32, componentY + componentRowHeight / 2 + 5);

          componentY += componentRowHeight;
        }
      });

      ctx.strokeStyle = getCSSColor("--np-line");
      ctx.strokeRect(cardX, yPos, cardWidth, cardHeight);

      yPos += cardHeight + cardSpacing;
    });

    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = getCSSColor("--np-muted");
    ctx.font = 'italic 14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('timetable.', maxWidth - 20, totalHeight - 15);
    ctx.restore();

    return canvas;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceData, friendCredentials, includeTcbr]);

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
      setRegisterLoadingText("fetching register…");
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

        // If an attendance fetch is currently in-flight, wait for it to finish first
        // so we get guaranteed fresh session cookies!
        if (fetchPromiseRef.current) {
          setRegisterLoadingText("syncing session…");
          await fetchPromiseRef.current;
          setRegisterLoadingText("fetching register…");
        } else {
          // Check if attendance cache is older than 1 minute (or missing)
          const cachedTime = localStorage.getItem("cached_attendance_time");
          const lastFetchMs = cachedTime ? new Date(cachedTime).getTime() : 0;
          const diffMs = Date.now() - lastFetchMs;
          const ONE_MINUTE_MS = 60 * 1000;

          // If cache is > 1 min old, session may be cold on ERP.
          // Pre-emptively refresh attendance session (takes ~2s) to guarantee warm session!
          if (!friendCredentials && (diffMs >= ONE_MINUTE_MS || !cachedTime)) {
            setRegisterLoadingText("renewing session (wait 2s)…");
            await fetchAttendanceData({ isBackground: true });
            setRegisterLoadingText("fetching register…");
          }
        }

        const doRegisterPost = async () => {
          const form = getRegisterDetailFormData(
            creds.username,
            creds.password,
            attendanceItem.register_href,
            { useStoredCookies: !friendCredentials }
          );
          return await axios.post(API_CONFIG.REGISTER_DETAIL_URL, form);
        };

        let res;
        try {
          res = await doRegisterPost();
        } catch (fetchErr) {
          console.warn("Direct register fetch failed, will attempt auto-heal:", fetchErr);
          res = null;
        }

        // If register failed or returned non-success (e.g. session expired / broken),
        // self-heal seamlessly: fetch fresh attendance session and retry once!
        if (!res || !res.data?.success) {
          setRegisterLoadingText("renewing session (wait 2s)…");
          const refreshed = await fetchAttendanceData({ isBackground: true });
          if (refreshed) {
            setRegisterLoadingText("fetching register…");
            try {
              res = await doRegisterPost();
            } catch (retryErr) {
              console.error("Retry register fetch error:", retryErr);
            }
          }
        }

        if (res && res.data?.success) {
          if (!friendCredentials) {
            handleSessionRefresh(res.data);
          }
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
          setToast({ show: true, message: res?.data?.message || "Failed to fetch register.", type: "error" });
        }
      } catch (err) {
        console.error("Register detail fetch error:", err);
        setShowRegisterModal(false);
        setToast({ show: true, message: "Failed to fetch register details.", type: "error" });
      } finally {
        setRegisterLoading(false);
        setRegisterLoadingText("fetching register…");
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
    setRegisterLoading(false);
    setRegisterLoadingText("fetching register…");
  };

  const courses = isLoading || error ? [] : groupAttendanceByCourse(attendanceData, includeTcbr);
  const belowTarget = courses.filter((c) => c.overallPercentage < targetPercentage).length;
  const average = courses.length
    ? Math.round(courses.reduce((sum, c) => sum + c.overallPercentage, 0) / courses.length)
    : 0;

  const openSimulator = (course = null) => {
    setSimulatorCourseCode(course ? course.courseCode : "");
    setCalculatorInitialCourse(
      course
        ? course.sections
            .map((section) => ({
              type: section.ltps.charAt(0).toUpperCase(),
              attended: section.totalAttended,
              conducted: section.totalConducted,
              tcbr: includeTcbr ? section.tcbr || "0" : "0",
            }))
            .filter((item) => ["L", "T", "P", "S"].includes(item.type))
        : null
    );
    setShowSimulatorModal(true);
  };

  return (
    <NeoShell onRefresh={fetchAttendanceData} autoSyncing={autoSyncing}>
      <div className="np-pagehead">
        <div className="np-pagehead__row">
          <h1 className="np-pagehead__title">
            {friendCredentials ? `${friendCredentials.name}'s attendance` : "Attendance"}
          </h1>
          {attendanceData.length > 0 && (
            <div className="np-pagehead__actions">
              <button
                className="np-iconbtn"
                onClick={() => openSimulator()}
                aria-label="Bunk calculator"
                title="Bunk calculator"
              >
                <MdCalculate size={20} />
              </button>
              <button
                className="np-iconbtn"
                onClick={exportAsImage}
                disabled={exporting}
                aria-label="Share attendance"
                title="Share attendance"
              >
                <MdIosShare size={19} />
              </button>
            </div>
          )}
        </div>
        {(lastFetchedTime || autoSyncing) && !friendCredentials && (
          <p className="np-pagehead__sub">
            {autoSyncing ? "Updating…" : `Updated ${formatTimeAgo(lastFetchedTime)}`}
          </p>
        )}
      </div>

      {isLoading ? (
        <NeoLoading text={`Fetching ${friendCredentials ? `${friendCredentials.name}'s` : "your"} attendance…`} />
      ) : error ? (
        error.includes("Session expired") || error.includes("log in") ? (
          <div className="np-empty">
            <h2 className="np-empty__title">See your attendance</h2>
            <p className="np-empty__text">Log in with your KL ERP account to load it and plan your bunks.</p>
            <button type="button" className="np-btn" onClick={() => setShowGuestModal(true)}>Log in</button>
          </div>
        ) : (
          <div className="np-empty">
            <h2 className="np-empty__title">Couldn't load attendance</h2>
            <p className="np-empty__text">{error}</p>
            <button type="button" className="np-btn" onClick={fetchAttendanceData}>Try again</button>
          </div>
        )
      ) : courses.length === 0 ? (
        <div className="np-empty">
          <h2 className="np-empty__title">No attendance yet</h2>
          <p className="np-empty__text">Nothing came back from ERP for this semester.</p>
        </div>
      ) : (
        <>
          <section className="np-attsum">
            <div>
              <div className={`np-attsum__pct ${getPctClass(average)}`}>{average}%</div>
              <div className="np-attsum__label">
                {belowTarget === 0
                  ? `All ${courses.length} subjects at or above ${targetPercentage}%`
                  : `${belowTarget} of ${courses.length} subjects below ${targetPercentage}%`}
              </div>
            </div>
            <div className="np-attsum__controls">
              <button type="button" className="np-chipbtn" onClick={() => setShowTargetModal(true)}>
                Target {targetPercentage}%
              </button>
              {hasAnyTcbr && (
                <button
                  type="button"
                  className={`np-chipbtn${includeTcbr ? " is-on" : ""}`}
                  role="switch"
                  aria-checked={includeTcbr}
                  onClick={toggleTcbr}
                  title="Count TCBR (condoned classes) in your percentage"
                >
                  TCBR {includeTcbr ? "on" : "off"}
                </button>
              )}
            </div>
          </section>

          {courses.map((course) => {
            const nickname = getSubjectName(course.courseCode);
            return (
              <article key={course.courseCode} className="np-att">
                <header className="np-att__head">
                  <div className="np-att__title">
                    <h2 className="np-att__name">{titleCase(course.courseName)}</h2>
                    <div className="np-att__code">
                      {course.courseCode}
                      {nickname !== course.courseCode &&
                        nickname.toLowerCase() !== course.courseName.toLowerCase() &&
                        ` · ${nickname}`}
                    </div>
                  </div>
                  <div className={`np-att__total-pct ${getPctClass(course.overallPercentage)}`}>
                    {course.overallPercentage}%
                  </div>
                </header>

                {course.sections.map((section) => {
                  const attended = parseInt(section.totalAttended);
                  const conducted = parseInt(section.totalConducted);
                  const tcbr = parseInt(section.tcbr || "0");
                  const effectiveTcbr = includeTcbr ? (tcbr > 0 ? tcbr : 0) : 0;
                  const effectiveConducted = includeTcbr ? Math.max(0, conducted - effectiveTcbr) : conducted;
                  const safeAttended = Number.isFinite(attended) ? attended : 0;
                  const hasNums = Number.isFinite(attended) && Number.isFinite(conducted) && effectiveConducted > 0;
                  const currentPct = hasNums ? (safeAttended / effectiveConducted) * 100 : 0;
                  const type = section.ltps.charAt(0).toUpperCase();
                  const hasRegister = ["L", "P", "S", "T"].includes(type);

                  return (
                    <button
                      key={`${section.ltps}-${section.section}`}
                      type="button"
                      className="np-att__section"
                      disabled={!hasRegister}
                      onClick={() => handleRegisterFetch(course, section)}
                      aria-label={`${COMPONENT_NAMES[type] || section.ltps} register`}
                    >
                      <span className="np-att__ltps">{section.ltps}</span>
                      <span className="np-att__section-info">
                        <span className="np-att__section-name">
                          {COMPONENT_NAMES[type] || section.ltps} · {section.section}
                        </span>
                        <span className="np-att__detail">
                          {section.totalAttended} of {section.totalConducted} · {section.totalAbsent} absent
                          {tcbr > 0 && ` · TCBR ${tcbr}${includeTcbr ? "" : " (off)"}`}
                        </span>
                      </span>
                      <span className="np-att__nums">
                        <span className={`np-att__pct ${getPctClass(section.rawPercentage)}`}>
                          {Math.ceil(parseFloat(section.rawPercentage))}%
                        </span>
                        {hasNums && (
                          <span className="np-att__hint">
                            {currentPct >= targetPercentage
                              ? `Can miss ${safeBunksAtTarget(safeAttended, effectiveConducted, targetPercentage)}`
                              : `Attend ${classesToReachTarget(safeAttended, effectiveConducted, targetPercentage)} more`}
                          </span>
                        )}
                      </span>
                      {hasRegister && <MdChevronRight className="np-att__chev" size={20} aria-hidden="true" />}
                    </button>
                  );
                })}

                <footer className="np-att__tools">
                  <button type="button" className="np-minibtn" onClick={() => openSimulator(course)}>
                    Plan bunks
                  </button>
                  <button
                    type="button"
                    className="np-minibtn"
                    onClick={() => {
                      setSelectedCourseData(course);
                      setShowCalculationModal(true);
                    }}
                  >
                    How it's calculated
                  </button>
                </footer>
              </article>
            );
          })}
        </>
      )}

      <CalculatorModal
        isOpen={showSimulatorModal && bunkMode === "old"}
        onClose={() => {
          setShowSimulatorModal(false);
          setSimulatorCourseCode("");
          setCalculatorInitialCourse(null);
        }}
        initialCourseData={calculatorInitialCourse}
        modeSwitch={<BunkModeSwitch mode={bunkMode} onChange={setBunkMode} />}
      />

      <BunkSimulatorModal
        isOpen={showSimulatorModal && bunkMode === "new"}
        modeSwitch={<BunkModeSwitch mode={bunkMode} onChange={setBunkMode} />}
        onClose={() => {
          setShowSimulatorModal(false);
          setSimulatorCourseCode("");
          setCalculatorInitialCourse(null);
        }}
        attendanceData={attendanceData}
        initialCourseCode={simulatorCourseCode}
        includeTcbr={includeTcbr}
        targetPercentage={targetPercentage}
        timetable={friendCredentials ? {} : undefined}
      />

      <ShowCalculation
        isOpen={showCalculationModal}
        onClose={() => {
          setShowCalculationModal(false);
          setSelectedCourseData(null);
        }}
        courseData={selectedCourseData}
        includeTcbr={includeTcbr}
        onToggleTcbr={toggleTcbr}
      />

      {/* register details */}
      <NeoModal open={showRegisterModal} title="Register" onClose={closeRegisterModal}>
        {registerLoading ? (
          <NeoLoading text={registerLoadingText} />
        ) : selectedRegisterData?.daily_attendance?.length > 0 ? (
          <div className="np-reglist">
            {[...selectedRegisterData.daily_attendance]
              // keep real class rows only; drop trailing summary rows (e.g. weighted % / absent totals)
              .filter((entry) => /\sH\s*\d/.test(entry?.date_slot || "") && ["P", "A"].includes(entry?.status))
              .reverse()
              .map((entry, index) => {
              const [date, hour] = entry.date_slot.split(" H ");
              const present = entry.status === "P";
              return (
                <div key={index} className="np-reglist__row">
                  <span>
                    {date}
                    {hour && <small> · Hour {hour}</small>}
                  </span>
                  <b className={present ? "np-good" : "np-bad"}>{present ? "Present" : "Absent"}</b>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="np-note">No class-by-class record is available for this component yet.</p>
        )}
      </NeoModal>

      {/* safe % target */}
      <NeoModal open={showTargetModal} title="Target attendance" onClose={() => setShowTargetModal(false)}>
        <p className="np-note" style={{ marginBottom: 16 }}>
          The percentage you want to stay above. "Can miss" and "Attend more" are worked out against it.
        </p>
        <div className="np-chips" style={{ marginBottom: 16 }}>
          {[75, 80, 85, 90].map((preset) => (
            <button
              key={preset}
              type="button"
              className={`np-chipbtn${Number(targetInput) === preset ? " is-on" : ""}`}
              onClick={() => {
                setTargetInput(String(preset));
                setTargetError("");
              }}
            >
              {preset}%
            </button>
          ))}
        </div>
        <div className="np-field">
          <div className="np-field__head">
            <label className="np-field__label" htmlFor="np-target">Target %</label>
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
        {targetError && <p className="np-formerror" role="alert">{targetError}</p>}
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
          Save
        </NeoButton>
      </NeoModal>

      <GuestAuthModal
        isOpen={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        pageType="attendance"
        onSuccess={async () => {
          setShowGuestModal(false);
          await fetchAttendanceData();
        }}
      />

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </NeoShell>
  );
}
