import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Header from "../components/Header";
import { getCredentials, saveCredentials, saveCookies, handleSessionRefresh } from "../../utils/storage.js";
import { getFormData, API_CONFIG, getCurrentAcademicYearOptions } from "../config/api.js";
import { NeoField, NeoSelect, NeoButton } from "../neo/NeoKit.jsx";
import { trackEvent } from "../utils/analytics";
import { useTheme } from "../contexts/ThemeContext";
import { Title, Meta, Link } from "react-head";

// Compact version of the attendance page's LTPS-weighted grouping,
// used for the quick-check teaser result.
const LTPS_WEIGHTS = { L: 100, T: 100, P: 50, S: 25, O: 1 };

function summarizeAttendance(attendance) {
  const grouped = {};
  attendance.forEach((item) => {
    const code = item.course_code ?? item.Coursecode ?? "";
    const name = item.course_name ?? item.Coursedesc ?? "";
    const type = (item.type ?? item.Ltps ?? "").charAt(0).toUpperCase();
    const conducted = parseInt(item.conducted ?? item["Total Conducted"] ?? "0", 10) || 0;
    const attended = parseInt(item.attended ?? item["Total Attended"] ?? "0", 10) || 0;
    const tcbr = parseInt(item.tcbr ?? item.Tcbr ?? "0", 10) || 0;
    if (!code) return;
    if (!grouped[code]) grouped[code] = { code, name, wAtt: 0, wCon: 0 };
    const w = LTPS_WEIGHTS[type] || LTPS_WEIGHTS.O;
    grouped[code].wAtt += (attended + (tcbr > 0 ? tcbr : 0)) * w;
    grouped[code].wCon += conducted * w;
  });

  const courses = Object.values(grouped)
    .map((c) => ({
      code: c.code,
      name: c.name,
      pct: c.wCon > 0 ? Math.round((c.wAtt / c.wCon) * 100) : 0,
    }))
    .sort((a, b) => a.pct - b.pct);

  const overall = courses.length
    ? Math.round(courses.reduce((s, c) => s + c.pct, 0) / courses.length)
    : 0;

  return { courses, overall };
}

export default function Calculator() {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // ERP quick-check (the SEO -> signup funnel)
  const [qcUser, setQcUser] = useState("");
  const [qcPass, setQcPass] = useState("");
  const [qcSem, setQcSem] = useState("odd");
  const [qcYear, setQcYear] = useState("");
  const [qcLoading, setQcLoading] = useState(false);
  const [qcError, setQcError] = useState("");
  const [qcResult, setQcResult] = useState(null); // { courses, overall }

  useEffect(() => {
    const credentials = getCredentials();
    setIsLoggedIn(!!credentials);
    const y = new Date().getFullYear();
    setQcYear(`${y}-${(y + 1).toString().slice(-2)}`);
  }, []);

  const handleQuickCheck = async (e) => {
    e.preventDefault();
    if (!qcUser || !qcPass || !qcSem || !qcYear) {
      setQcError("Fill all fields.");
      return;
    }
    setQcError("");
    setQcResult(null);
    setQcLoading(true);
    trackEvent("quick_check_started", { source: "kl_calculator_page" });

    try {
      // 1. authenticate (same call as the login page)
      const loginForm = getFormData(qcUser, qcPass, "", qcSem, qcYear, "");
      const loginRes = await axios.post(API_CONFIG.FETCH_URL, loginForm);

      if (!loginRes.data?.success) {
        setQcError("Wrong university id or password.");
        trackEvent("quick_check_failed", { reason: "auth" });
        return;
      }

      // 2. persist — the visitor is now inside the app
      saveCredentials({ username: qcUser, password: qcPass });
      if (loginRes.data.cookies) saveCookies(loginRes.data.cookies);
      if (loginRes.data.timetable) {
        localStorage.setItem("timetable", JSON.stringify(loginRes.data.timetable));
      }
      localStorage.setItem("semester", qcSem);
      localStorage.setItem("academicYear", qcYear);

      // 3. fetch attendance for the teaser
      const attForm = getFormData(qcUser, qcPass, "", qcSem, qcYear, "");
      const attRes = await axios.post(API_CONFIG.ATTENDANCE_URL, attForm);

      if (!attRes.data?.success) {
        setQcError(attRes.data?.message || "Attendance fetch failed. Open the app to retry.");
        trackEvent("quick_check_failed", { reason: "attendance" });
        return;
      }
      handleSessionRefresh(attRes.data);

      const summary = summarizeAttendance(attRes.data.attendance || []);
      localStorage.setItem("cached_attendance", JSON.stringify(attRes.data.attendance || []));
      localStorage.setItem("cached_attendance_time", new Date().toISOString());
      setQcResult(summary);
      trackEvent("quick_check_success", {
        course_count: summary.courses.length,
        average_percentage: summary.overall,
      });
    } catch (err) {
      const status = err.response?.status;
      const msg =
        status === 500 || status === 401
          ? "Wrong university id or password."
          : err.response?.data?.detail || "Something went wrong. Try again.";
      setQcError(msg);
      trackEvent("quick_check_failed", { reason: "error" });
    } finally {
      setQcLoading(false);
    }
  };
  
  // State for Percentage/Sick Tab
  const [activeTab, setActiveTab] = useState("components");
  const [attendedClasses, setAttendedClasses] = useState("");
  const [totalClasses, setTotalClasses] = useState("");
  const [tcbr, setTcbr] = useState("");
  const [percentage, setPercentage] = useState(null);
  const [error, setError] = useState("");
  const [isSickCalculator, setIsSickCalculator] = useState(false);
  const [requiredPercentage, setRequiredPercentage] = useState("");
  const [sickResult, setSickResult] = useState(null);

  // Constants and State for Components Tab
  const LTPS_WEIGHTS = {
    L: 100,
    T: 100,
    P: 50,
    S: 25,
    O: 1,
  };

  const initialComponents = [
    { label: "Lecture (L)", type: "L", attended: "", conducted: "", tcbr: "" },
    { label: "Tutorial (T)", type: "T", attended: "", conducted: "", tcbr: "" },
    { label: "Practical (P)", type: "P", attended: "", conducted: "", tcbr: "" },
    { label: "Skilling (S)", type: "S", attended: "", conducted: "", tcbr: "" },
  ];
  const [componentsData, setComponentsData] = useState(initialComponents);
  const [weightedAverage, setWeightedAverage] = useState(null);
  const [compError, setCompError] = useState("");
  
  // State for tracking which component inputs are open/collapsed
  const initialOpenState = {
    L: false,
    T: false,
    P: false,
    S: false,
  };
  const [isComponentOpen, setIsComponentOpen] = useState(initialOpenState);

  const toggleOpen = (type) => {
    setIsComponentOpen(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const computeWeightedAverage = (currentComponents) => {
    let weightedAttendedSum = 0;
    let weightedConductedSum = 0;

    currentComponents.forEach((comp) => {
      const attended = parseInt(comp.attended || "0", 10);
      const conducted = parseInt(comp.conducted || "0", 10);
      const tcbrValue = parseInt(comp.tcbr || "0", 10);

      if (conducted <= 0 || !Number.isFinite(attended) || attended < 0 || tcbrValue < 0) {
        return;
      }
      
      const componentType = comp.type.charAt(0).toUpperCase();
      const weight = LTPS_WEIGHTS[componentType] || LTPS_WEIGHTS.O;
      
      const adjustedAttended = attended + tcbrValue;

      weightedAttendedSum += adjustedAttended * weight;
      weightedConductedSum += conducted * weight;
    });

    if (weightedConductedSum > 0) {
      const calculated = (weightedAttendedSum / weightedConductedSum) * 100;
      return Math.ceil(Math.max(0, Math.min(100, calculated)));
    } else {
      return null;
    }
  };

  const updateComponentValue = (index, field, rawValue) => {
    const value = rawValue.replace(/[^0-9]/g, "");

    const nextComponents = componentsData.map((comp, i) =>
      i === index ? { ...comp, [field]: value } : comp
    );
    
    const currentComp = nextComponents[index];
    const attendedNum = parseInt(currentComp.attended || "0", 10);
    const conductedNum = parseInt(currentComp.conducted || "0", 10);
    const tcbrNum = parseInt(currentComp.tcbr || "0", 10);

    if (conductedNum > 0 && (attendedNum + tcbrNum) > conductedNum) {
      setCompError(`${currentComp.label}: Attended + Tcbr (${attendedNum + tcbrNum}) cannot exceed Conducted (${conductedNum}).`);
    } else {
      setCompError("");
    }

    setComponentsData(nextComponents);
    setWeightedAverage(computeWeightedAverage(nextComponents));
  };

  const reqAttendance = (present, total, percentage) => {
    const needed = (percentage * total - 100 * present) / (100 - percentage);
    return Math.ceil(needed);
  };

  const daysToSick = (present, total, percentage) => {
    const available = (100 * present - percentage * total) / percentage;
    return Math.floor(available);
  };

  const calculateSickClasses = () => {
    setError("");
    setSickResult(null);
    setPercentage(null);

    const attendedStr = attendedClasses.trim();
    const totalStr = totalClasses.trim();
    const requiredStr = requiredPercentage.trim();
    const tcbrStr = tcbr.trim();

    if (!/^\d+$/.test(attendedStr) || !/^\d+$/.test(totalStr)) {
      setError("Attended/Total must be whole numbers.");
      return;
    }
    const requiredNum = parseFloat(requiredStr);
    if (!requiredStr || isNaN(requiredNum) || requiredNum < 0 || requiredNum > 100) {
      setError("Required Percentage must be between 0 and 100.");
      return;
    }

    const attended = parseInt(attendedStr, 10);
    const total = parseInt(totalStr, 10);
    const tcbrValue = parseInt(tcbrStr || "0", 10);
    const required = requiredNum;

    if (total <= 0) {
      setError("Total classes must be greater than 0.");
      return;
    }
    if (attended < 0 || attended > total) {
      setError("Attended must be between 0 and total.");
      return;
    }
    if (tcbrValue < 0) {
      setError("Tcbr must be 0 or greater.");
      return;
    }

    const adjustedAttended = attended + (tcbrValue > 0 ? tcbrValue : 0);
    const currentPercent = (adjustedAttended / total) * 100;
    const currentPercentFormatted = currentPercent.toFixed(2);

    if (currentPercent >= required) {
      const daysAvailableToSick = daysToSick(adjustedAttended, total, required);
      let outputLine1 = `🟢 Attendance: ${currentPercentFormatted}%`;
      let outputLine2;

      if (daysAvailableToSick < 0 || daysAvailableToSick === 0) {
        outputLine2 = `🚫 Sick Days Left: 0 (Must attend)`;
      } else {
        outputLine2 = `🕒 Sick Days Left: ${daysAvailableToSick}`;
      }

      if (tcbrValue > 0) {
        outputLine1 += ` (tcbr=${tcbrValue})`;
      }

      setSickResult(`${outputLine1}<br/>${outputLine2}`);
    } else {
      const attendanceNeeded = reqAttendance(adjustedAttended, total, required);
      let outputLine1 = `🔴 Attendance: ${currentPercentFormatted}%`;
      let outputLine2;

      if (!Number.isFinite(attendanceNeeded) || attendanceNeeded < 0) {
        outputLine2 = `❌ Attend Required: Goal Unrealistic`;
      } else {
        outputLine2 = `⬆️ Attend Required: ${attendanceNeeded} (50 mins class each)`;
      }

      if (tcbrValue > 0) {
        outputLine1 += ` (tcbr=${tcbrValue})`;
      }

      setSickResult(`${outputLine1}<br/>${outputLine2}`);
    }
  };

  const calculatePercentage = () => {
    setError("");
    setPercentage(null);
    setSickResult(null);

    const attendedStr = attendedClasses.trim();
    const totalStr = totalClasses.trim();
    const tcbrStr = tcbr.trim();

    if (!/^\d+$/.test(attendedStr) || !/^\d+$/.test(totalStr)) {
      setError("Only whole numbers allowed");
      return;
    }
    const attended = parseInt(attendedStr, 10);
    const total = parseInt(totalStr, 10);
    const tcbrValue = parseInt(tcbrStr || "0", 10);
    if (!Number.isFinite(attended) || !Number.isFinite(total)) {
      setError("Enter valid numbers");
      return;
    }
    if (total <= 0) {
      setError("Total must be > 0");
      return;
    }
    if (attended < 0 || attended > total) {
      setError("Attended must be between 0 and total");
      return;
    }
    if (tcbrValue < 0) {
      setError("Tcbr must be 0 or greater");
      return;
    }
    const adjustedAttended = attended + (tcbrValue > 0 ? tcbrValue : 0);
    const raw = (adjustedAttended / total) * 100;
    const result = raw.toFixed(2);
    setPercentage(result);
  };

  const handleCalculateClick = () => {
    if (isSickCalculator) {
      calculateSickClasses();
    } else {
      calculatePercentage();
    }
  };

  const clear = () => {
    setAttendedClasses("");
    setTotalClasses("");
    setTcbr("");
    setPercentage(null);
    setError("");
    setRequiredPercentage("");
    setSickResult(null);
    setComponentsData(
      initialComponents.map((comp) => ({ ...comp, attended: "", conducted: "", tcbr: "" }))
    );
    setWeightedAverage(null);
    setCompError("");
    setIsComponentOpen(initialOpenState);
  };

  // Inline CSS Variables for Dark/Light Mode compatibility
  const getStyleVars = () => {
    return {
      '--primary-color': '#007bff',
      '--text-primary': isDarkMode ? '#f8f9fa' : '#212529',
      '--text-secondary': isDarkMode ? '#adb5bd' : '#6c757d',
      '--card-bg': isDarkMode ? '#1f1f1f' : '#ffffff',
      '--bg-secondary': isDarkMode ? '#2a2a2a' : '#f8f9fa',
      '--border-color': isDarkMode ? '#3a3a3a' : '#dee2e6',
      '--border-light': isDarkMode ? '#444' : '#e9ecef',
      '--input-bg': isDarkMode ? '#151515' : '#ffffff',
      '--input-border': isDarkMode ? '#555' : '#ced4da',
    };
  };

  return (
    <>
      <Title>KL Attendance Calculator 2026 | KL University ERP %, Sick Days & Weighted Average</Title>
      <Meta
        name="description"
        content="Free KL University attendance calculator — exact ERP percentage with LTPS weighting, TCBR support, weighted average, and sick-day planner. Updated for 2026. Check how many classes you can safely miss."
      />
      <Meta
        name="keywords"
        content="KL Calculator, KL University attendance calculator, timetable calculator, attendance percentage, KL ERP, weighted average calculator"
      />
      <Link rel="canonical" href="https://timetable.vercel.app/kl-calculator" />
      <Meta name="robots" content="index, follow" />
      {isLoggedIn ? (
        <Header onRefresh={() => {}} />
      ) : (
        <div className="app-header">
          <div className="header-left">
            <button onClick={() => navigate("/")} className="secondary">Login</button>
          </div>
          <div className="header-right" />
        </div>
      )}
      <div className="container" style={{ 
        position: "relative",
        marginTop: "16px",
        padding: "10px 12px", 
        display: "flex", 
        flexDirection: "column", 
        gap: "8px"
      }}>
        {isLoggedIn && (
          <button onClick={() => navigate("/home")} className="secondary">
            Back to Home
          </button>
        )}
      </div>
      {/* ---- ERP quick-check: the visitor's first taste of the app ---- */}
      <div className="container" style={{ maxWidth: "600px", margin: "0 auto", padding: "0 12px" }}>
        {qcResult ? (
          <div className="np-panel" style={{ marginTop: 4 }}>
            <div className="np-panel__label">your attendance · {qcSem} sem</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "6px 0 14px" }}>
              <span style={{ font: "400 44px/1 var(--np-font-disp, 'Archivo Black')", color: qcResult.overall >= 75 ? "var(--np-acid)" : "var(--np-pink)" }}>
                {qcResult.overall}%
              </span>
              <span className="np-note">overall · weighted</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {qcResult.courses.map((c) => (
                <span key={c.code} className="np-chip" title={c.name}>
                  {c.name || c.code} <small>{c.pct}%</small>
                </span>
              ))}
            </div>
            <p className="np-note" style={{ marginBottom: 14 }}>
              This updates automatically in the app — plus timetable, grades,
              safe-bunk hints and the daily game. Timetable syncs on its own.
            </p>
            <NeoButton onClick={() => navigate("/home")}>open the full app →</NeoButton>
          </div>
        ) : !isLoggedIn ? (
          <form className="np-panel" style={{ marginTop: 4 }} onSubmit={handleQuickCheck}>
            <div className="np-panel__label">instant check · no sign-up</div>
            <p className="np-note" style={{ margin: "0 0 14px" }}>
              Skip the typing — pull your <b>real attendance</b> straight from KL ERP.
              Trusted by <b>10,000+ KL students</b>. Credentials never leave this
              device; they're sent only to the university ERP.{" "}
              <a
                href="https://github.com/sivadhanushreddykotturu/TimeTablekl"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--np-acid)" }}
              >
                open source
              </a>
            </p>
            <NeoField
              id="qc-user"
              label="university id"
              placeholder="2400032717"
              value={qcUser}
              autoComplete="username"
              onChange={(e) => setQcUser(e.target.value)}
            />
            <NeoField
              id="qc-pass"
              label="password"
              type="password"
              placeholder="••••••••"
              value={qcPass}
              autoComplete="current-password"
              onChange={(e) => setQcPass(e.target.value)}
            />
            <div className="np-row">
              <NeoSelect id="qc-sem" label="semester" value={qcSem} onChange={(e) => setQcSem(e.target.value)}>
                <option value="odd">Odd</option>
                <option value="even">Even</option>
                <option value="summer">Summer</option>
                <option value="term3">Term 3</option>
              </NeoSelect>
              <NeoSelect id="qc-year" label="academic year" value={qcYear} onChange={(e) => setQcYear(e.target.value)}>
                {getCurrentAcademicYearOptions().map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </NeoSelect>
            </div>
            {qcError && (
              <p className="np-note" style={{ color: "var(--np-pink)", margin: "4px 0 10px" }}>{qcError}</p>
            )}
            <NeoButton loading={qcLoading} loadingText="fetching…">
              fetch my attendance
            </NeoButton>
          </form>
        ) : (
          <div className="np-panel" style={{ marginTop: 4 }}>
            <div className="np-panel__label">you're signed in</div>
            <p className="np-note" style={{ margin: "0 0 12px" }}>
              Your attendance, timetable and grades are waiting inside.
            </p>
            <NeoButton onClick={() => navigate("/home")}>open the app →</NeoButton>
          </div>
        )}
      </div>

      <div className="container" style={{ ...getStyleVars(), padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
        <div
          className="calculator-modal"
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            padding: "20px",
            margin: "20px 0",
            fontFamily: 'Inter, ui-sans-serif, system-ui'
          }}
        >
          <div className="calculator-header">
            <h1 style={{ margin: "0 0 8px 0", color: "var(--text-primary)", fontSize: "1.25rem" }}>
              KL University Attendance Calculator
            </h1>
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "8px",
                marginBottom: "12px",
                borderBottom: "1px solid var(--border-color)",
              }}
            >
              <div
                role="tab"
                onClick={() => setActiveTab("components")}
                style={{
                  padding: "6px 8px",
                  cursor: "pointer",
                  borderBottom:
                    activeTab === "components"
                      ? "2px solid var(--text-primary)"
                      : "2px solid transparent",
                  color:
                    activeTab === "components"
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                  fontWeight: activeTab === "components" ? 600 : 500,
                }}
              >
                Components
              </div>
              <div
                role="tab"
                onClick={() => setActiveTab("percentage")}
                style={{
                  padding: "6px 8px",
                  cursor: "pointer",
                  borderBottom:
                    activeTab === "percentage"
                      ? "2px solid var(--text-primary)"
                      : "2px solid transparent",
                  color:
                    activeTab === "percentage"
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                  fontWeight: activeTab === "percentage" ? 600 : 500,
                }}
              >
                Percentage
              </div>
            </div>
          </div>

          {/* Reusable Input Style */}
          <style>{`
            .form-group input {
              width: 100%;
              padding: 10px 12px;
              border: 1px solid var(--input-border);
              border-radius: 6px;
              background-color: var(--input-bg);
              color: var(--text-primary);
              font-size: 16px;
              transition: border-color 0.2s;
            }
            .form-group input:focus {
              border-color: var(--primary-color);
              outline: none;
            }
            button.primary {
              flex: 1;
              padding: 10px 15px;
              background-color: var(--primary-color);
              color: white;
              border: none;
              border-radius: 10px;
              cursor: pointer;
              font-weight: 600;
              transition: background-color 0.2s, transform 0.1s;
            }
            button.primary:hover {
              background-color: #0056b3;
            }
            button.primary:active {
              transform: scale(0.98);
            }
            button.secondary {
              flex: 1;
              padding: 10px 15px;
              background-color: var(--bg-secondary);
              color: var(--text-primary);
              border: 1px solid var(--border-color);
              border-radius: 10px;
              cursor: pointer;
              font-weight: 600;
              transition: background-color 0.2s, transform 0.1s;
            }
            button.secondary:hover {
              background-color: var(--border-light);
            }
            button.secondary:active {
              transform: scale(0.98);
            }
          `}</style>

          {activeTab === "percentage" && (
            <div className="calculator-body">
              {/* Modern Toggle Switch */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border-color)",
                  minHeight: "40px",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  Sick Calculator
                </span>
                <label
                  style={{
                    position: "relative",
                    display: "inline-block",
                    width: "48px",
                    height: "26px",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSickCalculator}
                    onChange={() => setIsSickCalculator(!isSickCalculator)}
                    style={{ display: "none" }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      borderRadius: "26px",
                      transition: "all 0.3s ease",
                      backgroundColor: isSickCalculator
                        ? "var(--primary-color)"
                        : "var(--bg-secondary)",
                      border: isSickCalculator
                        ? "1px solid transparent"
                        : "1px solid var(--border-color)",
                      boxShadow:
                        "inset 0 0 2px rgba(0,0,0,0.2), 0 0 1px rgba(0,0,0,0.05)",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      top: "3px",
                      left: isSickCalculator ? "26px" : "3px",
                      width: "20px",
                      height: "20px",
                      backgroundColor: "white",
                      borderRadius: "50%",
                      transition: "left 0.3s ease, box-shadow 0.3s ease",
                      boxShadow:
                        isSickCalculator
                          ? "0 0 6px var(--primary-color)"
                          : "0 1px 2px rgba(0,0,0,0.3)",
                      border: isDarkMode
                        ? "1px solid #555"
                        : "1px solid #ccc",
                    }}
                  />
                </label>
              </div>

              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="attended" style={{ display: "block", marginBottom: "6px" }}>
                  Attended classes
                </label>
                <input
                  id="attended"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="0"
                  placeholder="e.g., 5"
                  value={attendedClasses}
                  onChange={(e) =>
                    setAttendedClasses(e.target.value.replace(/[^0-9]/g, ""))
                  }
                />
              </div>

              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="total" style={{ display: "block", marginBottom: "6px" }}>
                  Total classes
                </label>
                <input
                  id="total"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="1"
                  placeholder="e.g., 8"
                  value={totalClasses}
                  onChange={(e) =>
                    setTotalClasses(e.target.value.replace(/[^0-9]/g, ""))
                  }
                />
              </div>

              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label htmlFor="tcbr" style={{ display: "block", marginBottom: "6px" }}>
                  Tcbr (optional)
                </label>
                <input
                  id="tcbr"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="0"
                  placeholder="e.g., 1"
                  value={tcbr}
                  onChange={(e) =>
                    setTcbr(e.target.value.replace(/[^0-9]/g, ""))
                  }
                />
              </div>

              {isSickCalculator && (
                <div className="form-group" style={{ marginBottom: "12px" }}>
                  <label
                    htmlFor="required-percent"
                    style={{ display: "block", marginBottom: "6px" }}
                  >
                    Required Percentage (%)
                  </label>
                  <input
                    id="required-percent"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="e.g., 75.0"
                    value={requiredPercentage}
                    onChange={(e) => setRequiredPercentage(e.target.value)}
                  />
                </div>
              )}

              {error && (
                <div
                  style={{
                    color: "#dc3545",
                    fontSize: "14px",
                    marginBottom: "12px",
                  }}
                >
                  {error}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "center",
                  marginTop: "8px",
                }}
              >
                <button onClick={handleCalculateClick} className="primary">
                  {isSickCalculator ? "Calculate Sick" : "Calculate Percentage"}
                </button>
                <button onClick={clear} className="secondary">
                  Clear
                </button>
              </div>

              {isSickCalculator && sickResult !== null && (
                <div
                  style={{
                    marginTop: "16px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "8px",
                    padding: "12px",
                    textAlign: "center",
                    color: "var(--text-primary)",
                    fontWeight: 600,
                    fontSize: "18px",
                  }}
                  dangerouslySetInnerHTML={{ __html: sickResult }}
                />
              )}

              {!isSickCalculator && percentage !== null && (
                <div
                  style={{
                    marginTop: "16px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "8px",
                    padding: "12px",
                    textAlign: "center",
                    color: "var(--text-primary)",
                    fontWeight: 600,
                    fontSize: "18px",
                  }}
                >
                  Percentage: {percentage}%
                  {(() => {
                    const tcbrValue = parseInt(tcbr.trim() || "0", 10);
                    return tcbrValue > 0 ? ` (tcbr=${tcbrValue})` : "";
                  })()}
                </div>
              )}
            </div>
          )}

          {activeTab === "components" && (
            <div className="calculator-body">
              {componentsData.map((comp, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: "16px",
                    padding: "10px",
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-secondary)'
                  }}
                >
                  {/* Collapsible Header */}
                  <div 
                      style={{ 
                          display: "flex", 
                          justifyContent: "space-between", 
                          alignItems: "center", 
                          cursor: "pointer",
                          minHeight: '20px'
                      }}
                      onClick={() => toggleOpen(comp.type)}
                  >
                      <label style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {comp.label}
                      </label>
                      
                      {/* Toggle Icon (Chevron-down) */}
                      <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          width="20" 
                          height="20" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="var(--text-primary)" 
                          strokeWidth="2.5" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          style={{ 
                              transition: 'transform 0.2s',
                              transform: isComponentOpen[comp.type] ? 'rotate(0deg)' : 'rotate(-90deg)'
                          }}
                      >
                          <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                  </div>

                  {/* Inputs - Conditionally Rendered */}
                  {isComponentOpen[comp.type] && (
                      <div style={{ paddingTop: '10px', marginTop: '5px', borderTop: '1px solid var(--border-light)' }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                              <div className="form-group">
                                  <label style={{ display: "block", marginBottom: "4px", fontSize: '0.85rem' }}>Attended</label>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    step="1"
                                    value={comp.attended}
                                    onChange={(e) => updateComponentValue(i, 'attended', e.target.value)}
                                    placeholder="e.g., 17"
                                  />
                              </div>
                              <div className="form-group">
                                  <label style={{ display: "block", marginBottom: "4px", fontSize: '0.85rem' }}>Conducted</label>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    step="1"
                                    value={comp.conducted}
                                    onChange={(e) => updateComponentValue(i, 'conducted', e.target.value)}
                                    placeholder="e.g., 20"
                                  />
                              </div>
                              <div className="form-group">
                                  <label style={{ display: "block", marginBottom: "4px", fontSize: '0.85rem' }}>Tcbr</label>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    step="1"
                                    value={comp.tcbr}
                                    onChange={(e) => updateComponentValue(i, 'tcbr', e.target.value)}
                                    placeholder="e.g., 0"
                                  />
                              </div>
                          </div>
                      </div>
                  )}
                </div>
              ))}

              {/* Clear Button */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginTop: "4px",
                  marginBottom: "8px",
                  justifyContent: "center",
                }}
              >
                <button type="button" className="secondary" onClick={clear} style={{ flex: 1 }}>
                  Clear All
                </button>
              </div>

              {/* Error Message */}
              {compError && (
                <div
                  style={{
                    color: "#dc3545",
                    fontSize: "14px",
                    marginBottom: "12px",
                    marginTop: "8px",
                    textAlign: "center"
                  }}
                >
                  {compError}
                </div>
              )}

              {/* Result */}
              {weightedAverage !== null && (
                <div
                  style={{
                    marginTop: "16px",
                    background: "var(--primary-color)",
                    color: "white",
                    borderRadius: "8px",
                    padding: "12px",
                    textAlign: "center",
                    fontWeight: 600,
                    fontSize: "1.1rem",
                    boxShadow: '0 4px 10px rgba(0, 123, 255, 0.3)'
                  }}
                >
                  Weighted Average: {weightedAverage}%
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---- Crawlable content: this page is the SEO entry point ---- */}
        <article
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.95rem",
            lineHeight: 1.7,
            padding: "0 4px 40px",
            fontFamily: 'Inter, ui-sans-serif, system-ui',
          }}
        >
          <h2 style={{ color: "var(--text-primary)", fontSize: "1.1rem", margin: "24px 0 8px" }}>
            What is the KL Attendance Calculator?
          </h2>
          <p>
            A free calculator for KL University (KLEF) students to check attendance
            percentage exactly the way the ERP computes it — with LTPS weighting
            (Lecture ×100, Tutorial ×100, Practical ×50, Skilling ×25) and TCBR
            regularization credits added to your attended count. It also works as a
            sick-day planner: enter your numbers and see how many classes you can
            safely miss, or how many you must attend to recover.
          </p>

          <h2 style={{ color: "var(--text-primary)", fontSize: "1.1rem", margin: "24px 0 8px" }}>
            How to use it
          </h2>
          <p>
            Open your KL ERP attendance page, note the attended and conducted
            numbers for each component (L, T, P, S), and enter them in the
            Components tab for your weighted average — the same percentage the
            university uses. Use the Percentage tab for a quick single-course check,
            or switch on the Sick Calculator to plan bunks around the required
            percentage.
          </p>

          <h2 style={{ color: "var(--text-primary)", fontSize: "1.1rem", margin: "24px 0 8px" }}>
            Frequently asked questions
          </h2>

          <h3 style={{ color: "var(--text-primary)", fontSize: "1rem", margin: "16px 0 4px" }}>
            How is KL University attendance percentage calculated?
          </h3>
          <p>
            Attendance % = (attended + TCBR) ÷ conducted × 100. Your overall
            percentage is a weighted average across LTPS components, where Lecture
            and Tutorial hours weigh 100, Practical 50, and Skilling 25.
          </p>

          <h3 style={{ color: "var(--text-primary)", fontSize: "1rem", margin: "16px 0 4px" }}>
            What is TCBR in KL ERP?
          </h3>
          <p>
            TCBR is the regularization credit shown in the KL ERP attendance
            register — it is added to your attended classes, so include it when
            calculating your real percentage.
          </p>

          <h3 style={{ color: "var(--text-primary)", fontSize: "1rem", margin: "16px 0 4px" }}>
            How many classes can I miss and still stay safe?
          </h3>
          <p>
            Use the Sick Calculator above: enter attended, total and your target
            percentage (most KL courses require 75% — check your academic
            regulations). It tells you exactly how many 50-minute classes you can
            skip, or how many you must attend to recover.
          </p>

          <h3 style={{ color: "var(--text-primary)", fontSize: "1rem", margin: "16px 0 4px" }}>
            Is there an easier way than typing ERP numbers?
          </h3>
          <p>
            Yes — the TimeTable PWA pulls your attendance, timetable and grades
            straight from the ERP after one sign-in, and computes safe bunks per
            course automatically.{" "}
            <a href="/" style={{ color: "var(--primary-color)" }}>
              Open the app
            </a>
            .
          </p>
        </article>

        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "How is KL University attendance percentage calculated?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Attendance % = (attended + TCBR) ÷ conducted × 100. The overall percentage is a weighted average across LTPS components: Lecture and Tutorial weigh 100, Practical 50, Skilling 25.",
                },
              },
              {
                "@type": "Question",
                name: "What is TCBR in KL ERP?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "TCBR is the regularization credit shown in the KL ERP attendance register. It is added to your attended classes when computing your real attendance percentage.",
                },
              },
              {
                "@type": "Question",
                name: "How many classes can I miss and still stay safe?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Enter attended, total and your target percentage (most KL courses require 75%) in the Sick Calculator to see exactly how many 50-minute classes you can skip or must attend to recover.",
                },
              },
              {
                "@type": "Question",
                name: "Is there an easier way than typing ERP numbers?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Yes — the TimeTable PWA pulls attendance, timetable and grades directly from the ERP after one sign-in and computes safe bunks per course automatically.",
                },
              },
            ],
          })}
        </script>
      </div>
    </>
  );
}

