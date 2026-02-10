import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { clearCredentials } from "../../utils/storage.js";
import ThemeToggle from "./ThemeToggle.jsx";
import { getCurrentAcademicYearOptions } from "../config/api.js";
import { BiLogOut } from "react-icons/bi";
import LogoutModal from "./LogoutModal.jsx";

export default function Header({ onRefresh }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [semester, setSemester] = useState("odd");
  const [academicYear, setAcademicYear] = useState("");
  const [academicYearOptions, setAcademicYearOptions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const dropdownRef = useRef(null);

  // Don't show on login page
  if (location.pathname === "/") return null;

  const isExamPage = location.pathname === "/exam";

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    clearCredentials();
    localStorage.removeItem("timetable");
    navigate("/");
  };

  const handleBackFromExam = () => {
    localStorage.removeItem("examMode");
    navigate("/home");
  };

  useEffect(() => {
    const storedSemester = localStorage.getItem("semester") || "odd";
    const currentYear = new Date().getFullYear();
    const defaultAcademicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
    const storedAcademicYear = localStorage.getItem("academicYear") || defaultAcademicYear;

    setSemester(storedSemester);
    setAcademicYear(storedAcademicYear);

    const options = getCurrentAcademicYearOptions();
    const mergedOptions = Array.from(new Set([storedAcademicYear, ...options]));
    setAcademicYearOptions(mergedOptions);
  }, []);

  const handleSemesterChange = (value) => {
    setSemester(value);
    localStorage.setItem("semester", value);
  };

  const handleAcademicYearChange = (value) => {
    setAcademicYear(value);
    localStorage.setItem("academicYear", value);
  };

  const toggleDropdown = () => setShowDropdown((prev) => !prev);
  const isMaddySection = location.pathname.startsWith("/maddys");
  const isMaddyAttendance = isMaddySection && location.pathname.includes("attendance");
  const isAttendancePage = location.pathname === "/attendance";
  const showResync = !isMaddySection || isMaddyAttendance;

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  return (
    <div className="app-header">
      <div className="header-left">
        {isExamPage ? (
          <button onClick={handleBackFromExam} className="secondary">
            Back
          </button>
        ) : (
          <button onClick={handleLogoutClick} className="secondary" aria-label="Logout" title="Logout">
            <BiLogOut size={20} />
          </button>
        )}
      </div>
      <div className="header-right">
        <ThemeToggle />
        {showResync && (
          (isAttendancePage || isExamPage) ? (
            <button className="resync-btn" onClick={onRefresh}>
              ReSync
            </button>
          ) : (
            <div className="resync-wrapper" ref={dropdownRef}>
              <button className="resync-btn" onClick={toggleDropdown}>
                ReSync ▾
              </button>

              {showDropdown && (
                <div className="resync-dropdown">
                  <div className="resync-dropdown-group">
                    <label>Semester</label>
                    <select
                      value={semester}
                      onChange={(e) => handleSemesterChange(e.target.value)}
                      className="resync-select"
                    >
                      <option value="odd">Odd Semester</option>
                      <option value="even">Even Semester</option>
                      <option value="summer">Summer Semester</option>
                    </select>
                  </div>

                  <div className="resync-dropdown-group">
                    <label>Academic Year</label>
                    <select
                      value={academicYear}
                      onChange={(e) => handleAcademicYearChange(e.target.value)}
                      className="resync-select"
                    >
                      {academicYearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="resync-actions">
                    <button className="primary" onClick={() => { setShowDropdown(false); onRefresh(); }}>
                      Sync now
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
      />
    </div>
  );
}
