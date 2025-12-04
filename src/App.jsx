import React, { lazy, Suspense } from "react";
import { HeadProvider } from "react-head";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import AuthGuard from "./components/AuthGuard.jsx";
import Footer from "./components/Footer.jsx";
import PerformanceMonitor from "./components/PerformanceMonitor.jsx";
import GoogleAnalytics from "./components/GoogleAnalytics.jsx";
import LoginPage from "./pages/Login.jsx";
import HomePage from "./pages/Home.jsx";
import TimetablePage from "./pages/TimetableView.jsx";
import SubjectsPage from "./pages/Subjects.jsx";
import MaddysPage from "./pages/Maddys.jsx";
import MaddyClassInfo from "./pages/MaddyClassInfo.jsx";
import MaddyTimetable from "./pages/MaddyTimetable.jsx";
import AttendancePage from "./pages/Attendance.jsx";
import RegisterPage from "./pages/Register.jsx";
import ExamPage from "./pages/Exam.jsx";
import HandoutsPage from "./pages/Handouts.jsx";
const CalculatorPage = lazy(() => import("./pages/Calculator.jsx"));

// Lazy load analytics to reduce initial bundle size
const Analytics = lazy(() => import("@vercel/analytics/react").then(module => ({ default: module.Analytics })));

function App() {
  return (
    <HeadProvider>
      <ThemeProvider>
        <PerformanceMonitor />
        <Router>
          <GoogleAnalytics />
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
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/exam" element={<ExamPage />} />
              <Route path="/handouts" element={<HandoutsPage />} />
              <Route path="/kl-calculator" element={<CalculatorPage />} />
            </Routes>
            </Suspense>
            <Footer />
          </div>
        </Router>
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
      </ThemeProvider>
    </HeadProvider>
  );
}

export default App;
