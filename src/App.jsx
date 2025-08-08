import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import AuthGuard from "./components/AuthGuard.jsx";
import Footer from "./components/Footer.jsx";
import PerformanceMonitor from "./components/PerformanceMonitor.jsx";
import LoginPage from "./pages/Login.jsx";
import HomePage from "./pages/Home.jsx";
import TimetablePage from "./pages/TimetableView.jsx";
import SubjectsPage from "./pages/Subjects.jsx";
import MaddysPage from "./pages/Maddys.jsx";
import MaddyClassInfo from "./pages/MaddyClassInfo.jsx";
import MaddyTimetable from "./pages/MaddyTimetable.jsx";

// Lazy load analytics to reduce initial bundle siz
const Analytics = lazy(() => import("@vercel/analytics/react").then(module => ({ default: module.Analytics })));

function App() {
  return (
    <ThemeProvider>
      <PerformanceMonitor />
      <Router>
        <div className="app-wrapper">
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
          </Routes>
          <Footer />
        </div>
      </Router>
      <Suspense fallback={null}>
        <Analytics />
      </Suspense>
    </ThemeProvider>
  );
}

export default App;
//
