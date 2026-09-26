import React, { useState, useEffect } from "react";
import axios from "axios";
import { FiLock, FiSmartphone, FiCheckCircle, FiX, FiArrowRight } from "react-icons/fi";
import { saveCredentials, saveCookies } from "../../utils/storage.js";
import { getFormData, API_CONFIG, getCurrentAcademicYearOptions } from "../config/api.js";
import { syncTimetable } from "../../utils/syncTimetable.js";
import { NeoButton, NeoField, NeoSelect } from "../neo/NeoKit.jsx";
import { NeoModal } from "../neo/Shell.jsx";
import { trackEvent } from "../utils/analytics";

/**
 * Background helper to guarantee timetable is stored in localStorage if missing.
 */
export async function ensureTimetableFetched() {
  if (!localStorage.getItem("timetable")) {
    try {
      await syncTimetable();
    } catch (err) {
      console.warn("Background timetable fetch skipped:", err);
    }
  }
}

const PAGE_CONFIGS = {
  attendance: {
    emoji: "🎯",
    badge: "attendance calculator",
    title: "You're very near! Log in to view your live attendance.",
    desc: "Enter your KL ERP credentials to instantly fetch your real-time attendance, component breakdown & safe margin calculator.",
    buttonText: "Log In & View Attendance",
  },
  timetable: {
    emoji: "🗓️",
    badge: "weekly schedule",
    title: "You're very near! Log in to unlock your timetable.",
    desc: "Enter your KL ERP credentials to load your weekly class schedule, room locations & countdown timer.",
    buttonText: "Log In & View Timetable",
  },
  grades: {
    emoji: "📊",
    badge: "cgpa & sgpa",
    title: "You're very near! Log in to calculate your grades.",
    desc: "Enter your KL ERP credentials to view your SGPA per semester, total course credits & overall CGPA.",
    buttonText: "Log In & View Grades",
  },
  exam: {
    emoji: "📝",
    badge: "seating plan",
    title: "You're very near! Log in to check exam schedules.",
    desc: "Enter your KL ERP credentials to view your upcoming exam dates, timings & seating arrangements.",
    buttonText: "Log In & View Exam Schedule",
  },
  calculator: {
    emoji: "🧮",
    badge: "quick erp check",
    title: "You're very near! Log in for instant ERP calculation.",
    desc: "Enter your KL ERP credentials to calculate attendance percentages and save your timetable.",
    buttonText: "Log In & Calculate",
  },
  default: {
    emoji: "⚡",
    badge: "kl university erp",
    title: "You're very near! Log in to get started.",
    desc: "Enter your KL ERP credentials to get instant 1-tap access to your timetable, attendance, grades & exams.",
    buttonText: "Log In & Access App",
  },
};

export default function GuestAuthModal({
  isOpen,
  onClose,
  pageType = "default",
  onSuccess,
}) {
  const config = PAGE_CONFIGS[pageType] || PAGE_CONFIGS.default;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [semester, setSemester] = useState("odd");
  const [academicYear, setAcademicYear] = useState("");
  const [yearOptions, setYearOptions] = useState([]);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // PWA Prompt handling
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const currentYear = new Date().getFullYear();
    const defaultYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
    setAcademicYear(defaultYear);
    setYearOptions(Array.from(new Set([defaultYear, ...getCurrentAcademicYearOptions()])));

    // Check PWA status
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
      setIsPWAInstalled(true);
    }
    const userAgent = window.navigator.userAgent || "";
    setIsIOS(/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream);

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const handleAppInstalled = () => {
      setIsPWAInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsPWAInstalled(true);
        trackEvent("pwa_installed_from_guest_modal", { pageType });
      }
    } catch (err) {
      console.error("PWA install error:", err);
    } finally {
      setDeferredPrompt(null);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg("Please enter both University ID and Password.");
      return;
    }

    setIsLoggingIn(true);
    setErrorMsg("");

    try {
      // 1. Fetch timetable + session cookies from ERP
      const form = getFormData(username, password, "", semester, academicYear, "");
      const res = await axios.post(API_CONFIG.FETCH_URL, form);

      if (res.data && res.data.success) {
        // Save credentials and session metadata
        saveCredentials({ username, password });
        if (res.data.cookies) {
          saveCookies(res.data.cookies);
        }
        if (res.data.timetable) {
          localStorage.setItem("timetable", JSON.stringify(res.data.timetable));
        }
        localStorage.setItem("semester", semester);
        localStorage.setItem("academicYear", academicYear);

        trackEvent("guest_modal_login_success", { pageType });

        if (onSuccess) {
          await onSuccess(res.data);
        }

        // Guarantee timetable is stored in background if missing
        ensureTimetableFetched();

        if (onClose) onClose();
      } else {
        let msg = res.data?.message || "Login failed.";
        const lower = msg.toLowerCase();
        if (lower.includes("invalid") || lower.includes("credential") || lower.includes("password")) {
          msg = "Password wrong. Please check your username and password.";
        }
        setErrorMsg(msg);
        trackEvent("guest_modal_login_failed", { pageType, reason: msg });
      }
    } catch (err) {
      let msg = err.response?.data?.detail || err.response?.data?.message || "Something went wrong. Please check your credentials.";
      if (err.response?.status === 500 || err.response?.status === 401) {
        msg = "Password wrong. Please check your username and password.";
      }
      setErrorMsg(msg);
      trackEvent("guest_modal_login_failed", { pageType, reason: msg });
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (!isOpen) return null;

  return (
    <NeoModal open={isOpen} title={`${config.emoji} ${config.badge}`} onClose={onClose} wide>
      <div className="np-guest-modal">
        {/* Banner header */}
        <div className="np-guest-modal__head">
          <div className="np-eyebrow" style={{ color: "var(--np-acid)" }}>
            {config.emoji} Quick Access
          </div>
          <h2 className="np-guest-modal__title">{config.title}</h2>
          <p className="np-guest-modal__desc">{config.desc}</p>
        </div>

        {/* PWA Save App Prompt Card */}
        <div className="np-guest-pwa-card">
          <div className="np-guest-pwa-card__left">
            <FiSmartphone size={22} className="np-guest-pwa-card__icon" />
            <div>
              <strong className="np-guest-pwa-card__title">Save as PWA App</strong>
              <div className="np-guest-pwa-card__sub">
                {isPWAInstalled
                  ? "Installed! Enjoy fast 1-tap launcher access."
                  : deferredPrompt
                  ? "Add to home screen for fast 1-tap access & offline timetable."
                  : isIOS
                  ? "On Safari: Tap Share ➔ 'Add to Home Screen' for 1-tap app experience."
                  : "Save to your home screen for quick offline access!"}
              </div>
            </div>
          </div>
          {deferredPrompt && !isPWAInstalled && (
            <button type="button" onClick={handleInstallClick} className="np-guest-pwa-card__btn">
              Install App
            </button>
          )}
          {isPWAInstalled && (
            <span className="np-guest-pwa-card__badge">
              <FiCheckCircle size={14} /> Installed
            </span>
          )}
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="np-guest-modal__form">
          {errorMsg && (
            <div className="np-error" style={{ marginBottom: 12, padding: "10px 14px" }}>
              <p style={{ margin: 0, fontSize: 13 }}>{errorMsg}</p>
            </div>
          )}

          <NeoField
            id="np-guest-username"
            label="university id"
            placeholder="2400032717"
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
          />

          <NeoField
            id="np-guest-password"
            label="password"
            type="password"
            placeholder="••••••••"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="np-row">
            <NeoSelect
              id="np-guest-semester"
              label="semester"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
            >
              <option value="odd">Odd</option>
              <option value="even">Even</option>
              <option value="summer">Summer</option>
              <option value="term3">Term 3</option>
            </NeoSelect>

            <NeoSelect
              id="np-guest-year"
              label="academic year"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </NeoSelect>
          </div>

          <p className="np-note" style={{ marginTop: 4, marginBottom: 12, fontSize: 11 }}>
            🔒 Credentials are used solely to fetch your KL ERP data and remain stored safely on your device.
          </p>

          <NeoButton type="submit" loading={isLoggingIn} loadingText="authenticating & fetching…">
            {config.buttonText} <FiArrowRight style={{ marginLeft: 6 }} />
          </NeoButton>
        </form>
      </div>
    </NeoModal>
  );
}
