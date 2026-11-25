import React, { lazy, Suspense, useEffect, useState } from "react";
import { HeadProvider } from "react-head";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { SyncProvider } from "./contexts/SyncContext";
import AuthGuard from "./components/AuthGuard.jsx";
import GoogleAnalytics from "./components/GoogleAnalytics.jsx";
import HomePage from "./neo/pages/Home.jsx";
import AppNav from "./neo/components/AppNav.jsx";
import { useAppUpdater } from "./hooks/useAppUpdater";
import "./neo/neo.css";
import "./neo/core.css";

// Today is in the main bundle so a returning user sees their day at once.
// Every other screen is its own chunk, fetched (from the service-worker cache
// after the first visit) when it is first needed.
const pages = {
  login: () => import("./neo/Login.jsx"),
  timetable: () => import("./neo/pages/Timetable.jsx"),
  attendance: () => import("./neo/pages/Attendance.jsx"),
  profile: () => import("./neo/pages/Profile.jsx"),
  grades: () => import("./neo/pages/Grades.jsx"),
  internals: () => import("./neo/pages/Internals.jsx"),
  subjects: () => import("./neo/pages/Subjects.jsx"),
  maddys: () => import("./neo/pages/Maddys.jsx"),
  maddyClass: () => import("./neo/pages/MaddyClassInfo.jsx"),
  maddyTimetable: () => import("./neo/pages/MaddyTimetable.jsx"),
  exam: () => import("./neo/pages/Exam.jsx"),
  calculator: () => import("./neo/pages/Calculator.jsx"),
};

const LoginPage = lazy(pages.login);
const TimetablePage = lazy(pages.timetable);
const AttendancePage = lazy(pages.attendance);
const ProfilePage = lazy(pages.profile);
const GradesPage = lazy(pages.grades);
const InternalsPage = lazy(pages.internals);
const SubjectsPage = lazy(pages.subjects);
const MaddysPage = lazy(pages.maddys);
const MaddyClassInfo = lazy(pages.maddyClass);
const MaddyTimetable = lazy(pages.maddyTimetable);
const ExamPage = lazy(pages.exam);
const CalculatorPage = lazy(pages.calculator);

const DesktopCompanion = lazy(() => import("./neo/bot/DesktopCompanion.jsx"));

const DESKTOP = "(min-width: 1024px)";

/** The mascot animates at 60fps, so it is only loaded where it is shown. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP).matches);
  useEffect(() => {
    const query = window.matchMedia(DESKTOP);
    const onChange = (event) => setIsDesktop(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

const whenIdle = (fn) =>
  "requestIdleCallback" in window ? window.requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 1500);

function App() {
  // New builds download in the background and swap in when the app isn't in use
  useAppUpdater();
  const isDesktop = useIsDesktop();

  // full-bleed dark canvas, app-wide
  useEffect(() => {
    document.body.classList.add("np-body");
    return () => document.body.classList.remove("np-body");
  }, []);

  // Once the first screen is up, warm the other tabs so switching is instant.
  useEffect(() => {
    whenIdle(() => {
      pages.timetable();
      pages.attendance();
      pages.profile();
    });
  }, []);

  return (
    <HeadProvider>
        <SyncProvider>
          <Router>
            <GoogleAnalytics />
            {/* Companion lives here — above Routes, never remounts */}
            {isDesktop && (
              <Suspense fallback={null}>
                <DesktopCompanion />
              </Suspense>
            )}
            {/* The tab bar is mounted once, outside the routes, so its motion survives navigation */}
            <AppNav />
            <div className="app-wrapper">
              <Suspense fallback={<div className="np-boot" aria-busy="true" />}>
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
                  <Route path="/internals" element={<InternalsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/exam" element={<ExamPage />} />
                  <Route path="/kl-calculator" element={<CalculatorPage />} />
                  <Route path="/kl-attendance-calculator" element={<CalculatorPage />} />
                </Routes>
              </Suspense>
            </div>
          </Router>
        </SyncProvider>
    </HeadProvider>
  );
}

export default App;
