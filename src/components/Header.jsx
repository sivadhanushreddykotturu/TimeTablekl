import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { clearCredentials, getCredentials, saveCredentials } from "../../utils/storage.js";
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
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [avatarSeed, setAvatarSeed] = useState(() => localStorage.getItem("avatarSeed") || Math.random().toString(36).substring(7));
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const dropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("avatarSeed", avatarSeed);
  }, [avatarSeed]);

  useEffect(() => {
    const creds = getCredentials();
    if (creds) {
      setUsername(creds.username || "");
      setPassword(creds.password || "");
    }
  }, []);

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

  const handleRandomizeAvatar = () => {
    if (!navigator.onLine) {
      return;
    }
    setAvatarSeed(Math.random().toString(36).substring(7));
  };

  useEffect(() => {
    const storedSemester = localStorage.getItem("semester") || "odd";
    const validSemesters = new Set(["odd", "even", "summer", "term3"]);
    const cleanedSemester = validSemesters.has(storedSemester) ? storedSemester : "odd";
    const currentYear = new Date().getFullYear();
    const defaultAcademicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
    const storedAcademicYear = localStorage.getItem("academicYear") || defaultAcademicYear;

    setSemester(cleanedSemester);
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

  const handleSyncClick = async () => {
    if (isSyncing) return;
    setShowDropdown(false);
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      if (onRefresh) {
        await onRefresh();
        setSyncStatus("success");
      }
    } catch (err) {
      setSyncStatus("error");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };

  const toggleDropdown = () => setShowDropdown((prev) => !prev);
  const isMaddySection = location.pathname.startsWith("/maddys");
  const isMaddyAttendance = isMaddySection && location.pathname.includes("attendance");
  const isAttendancePage = location.pathname === "/attendance";
  const showResync = (!isMaddySection || isMaddyAttendance) && !isAttendancePage;

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    const handleClickOutsideProfile = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    if (showProfileDropdown) {
      document.addEventListener("mousedown", handleClickOutsideProfile);
    } else {
      document.removeEventListener("mousedown", handleClickOutsideProfile);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("mousedown", handleClickOutsideProfile);
    };
  }, [showDropdown, showProfileDropdown]);

  return (
    <div className="app-header">
      <div className="header-left">
        {isExamPage ? (
          <button onClick={handleBackFromExam} className="secondary">
            Back
          </button>
        ) : (
          <div className="resync-wrapper" ref={profileDropdownRef}>
            <button
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
              aria-label="Profile"
              title="Profile"
            >
              <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${avatarSeed}&backgroundColor=transparent`} alt="Profile" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-tertiary)' }} />
            </button>

            {showProfileDropdown && (
              <div className="resync-dropdown" style={{ left: 0, right: 'auto', minWidth: '200px' }}>
                <div className="resync-dropdown-group">
                  <label>Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-color)',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div className="resync-dropdown-group">
                  <label>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-color)',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div className="resync-dropdown-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <label style={{ margin: 0 }}>Theme</label>
                  <ThemeToggle />
                </div>

                <div className="resync-dropdown-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <label style={{ margin: 0 }}>Avatar</label>
                  <button 
                    onClick={handleRandomizeAvatar}
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)', minHeight: 'auto', width: 'auto' }}
                  >
                    🎲 Randomize
                  </button>
                </div>

                <div className="resync-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    className="primary"
                    onClick={() => {
                      saveCredentials({ username, password });
                      setShowProfileDropdown(false);
                    }}
                  >
                    Save
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      setShowProfileDropdown(false);
                      handleLogoutClick();
                    }}
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="header-right">
        {showResync && (
          (isAttendancePage || isExamPage) ? (
            <button className="resync-btn" onClick={handleSyncClick} disabled={isSyncing}>
              {isSyncing ? "Syncing..." : syncStatus === "success" ? "Synced 👍" : "ReSync"}
            </button>
          ) : (
            <div className="resync-wrapper" ref={dropdownRef}>
              <button className="resync-btn" onClick={toggleDropdown} disabled={isSyncing}>
                {isSyncing ? "Syncing..." : syncStatus === "success" ? "Synced 👍" : "ReSync ▾"}
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
                      <option value="term3">Term3</option>
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
                    <button className="primary" onClick={handleSyncClick} disabled={isSyncing}>
                      {isSyncing ? "Syncing..." : syncStatus === "success" ? "Synced 👍" : "Sync now"}
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
