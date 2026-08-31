import React, { lazy, Suspense, useEffect } from "react";
import { HeadProvider } from "react-head";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SyncProvider } from "./contexts/SyncContext";
import AuthGuard from "./components/AuthGuard.jsx";
import PerformanceMonitor from "./components/PerformanceMonitor.jsx";
import GoogleAnalytics from "./components/GoogleAnalytics.jsx";
import DesktopCompanion from "./neo/bot/DesktopCompanion.jsx";
import LoginPage from "./neo/Login.jsx";
import HomePage from "./neo/pages/Home.jsx";
import TimetablePage from "./neo/pages/Timetable.jsx";
import SubjectsPage from "./neo/pages/Subjects.jsx";
import MaddysPage from "./neo/pages/Maddys.jsx";
import MaddyClassInfo from "./neo/pages/MaddyClassInfo.jsx";
import MaddyTimetable from "./neo/pages/MaddyTimetable.jsx";
import AttendancePage from "./neo/pages/Attendance.jsx";
import GradesPage from "./neo/pages/Grades.jsx";
import ProfilePage from "./neo/pages/Profile.jsx";
import RegisterPage from "./pages/Register.jsx";
import ExamPage from "./neo/pages/Exam.jsx";
import Customization from "./neo/pages/Customization.jsx";
import { ToasterProvider } from "./components/Toast.jsx";
import { loadAndApplyTheme } from "./neo/utils/themeEngine";
import { useAppUpdater } from "./hooks/useAppUpdater";
import "./neo/neo.css";
const CalculatorPage = lazy(() => import("./pages/Calculator.jsx"));

// Lazy load analytics to reduce initial bundle size
const Analytics = lazy(() => import("@vercel/analytics/react").then(module => ({ default: module.Analytics })));

function App() {
  // Silent auto-updater for iOS / Android PWAs (zero stale cache)
  useAppUpdater();

  // neoPOP full-bleed black canvas, app-wide
  useEffect(() => {
    document.body.classList.add("np-body");
    loadAndApplyTheme();
    return () => document.body.classList.remove("np-body");
  }, []);

  return (
    <HeadProvider>
      <ThemeProvider>
        <SyncProvider>
          <PerformanceMonitor />
          <Router>
            <GoogleAnalytics />
            {/* Companion lives here — above Routes, never remounts */}
            <DesktopCompanion />
            <div className="app-wrapper">
              <Suspense fallback={<div className="loading-container">Loading...</div>}>
              <Routes>
                <Route path="/" element={
                  <AuthGuard>
                    <LoginPage />
                  </AuthGuard>
                } />
                <Route path="/home" element={<HomePage />} />
                <Route path="/timetable" element={<TimetablePage />} />
                <Route path="/subjects" element={<SubjectsPage />} />
                <Route path="/maddys" element={<MaddysPage />} />
                <Route path="/maddys/:id/class" element={<MaddyClassInfo />} />
                <Route path="/maddys/:id/timetable" element={<MaddyTimetable />} />
                <Route path="/attendance" element={<AttendancePage />} />
                <Route path="/grades" element={<GradesPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/customize" element={<Customization />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/exam" element={<ExamPage />} />
                <Route path="/games" element={<HomePage />} />
                <Route path="/games/flappy-bird" element={<HomePage />} />
                <Route path="/kl-calculator" element={<CalculatorPage />} />
              </Routes>
              </Suspense>
            </div>
          </Router>
          <Suspense fallback={null}>
            <Analytics />
          </Suspense>
          <ToasterProvider />
        </SyncProvider>
      </ThemeProvider>
    </HeadProvider>
  );
}

export default App;
