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
