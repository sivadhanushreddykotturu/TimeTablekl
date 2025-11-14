import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { clearCredentials, getCredentials } from "../../utils/storage.js";
import ThemeToggle from "./ThemeToggle.jsx";

export default function Header({ onRefresh }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show on login page
  if (location.pathname === "/") return null;

  const isExamPage = location.pathname === "/exam";

  const handleLogout = () => {
    clearCredentials();
    localStorage.removeItem("timetable");
    navigate("/");
  };

  const handleBackFromExam = () => {
    localStorage.removeItem("examMode");
    navigate("/home");
  };

  return (
    <div className="app-header">
      <div className="header-left">
        {isExamPage ? (
          <button onClick={handleBackFromExam} className="secondary">
            Back
          </button>
        ) : (
          <button onClick={handleLogout} className="secondary">
            Logout
          </button>
        )}
      </div>
      <div className="header-right">
        <ThemeToggle />
        <button className="resync-btn" onClick={onRefresh}>
          ReSync
        </button>
      </div>
    </div>
  );
}
