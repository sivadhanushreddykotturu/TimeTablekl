import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { saveCredentials } from "../../utils/storage.js";
import ThemeToggle from "../components/ThemeToggle.jsx";
import Toast from "../components/Toast.jsx";
import { getCaptchaUrl, getFormData, API_CONFIG, getCurrentAcademicYearOptions } from "../config/api.js";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaUrl, setCaptchaUrl] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(true);
  const [semester, setSemester] = useState("odd");
  const [academicYear, setAcademicYear] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const navigate = useNavigate();

  const refreshCaptcha = async () => {
    setCaptchaLoading(true);
    setCaptcha("");
    setSessionId("");
    
    try {
      const response = await axios.get(API_CONFIG.CAPTCHA_URL, {
        responseType: 'blob'
      });
      
      const sessionIdFromHeader =
        response.headers['x-session-id'] || 
        response.headers['X-Session-ID'] || 
        response.headers['X-SESSION-ID'];
      
      if (sessionIdFromHeader) {
        setSessionId(sessionIdFromHeader);
      } else {
        const fallbackSessionId = `session_${Date.now()}`;
        setSessionId(fallbackSessionId);
      }
      
      const imageUrl = URL.createObjectURL(response.data);
      setCaptchaUrl(imageUrl);
    } catch (error) {
      setToast({
        show: true,
        message: "Failed to load CAPTCHA",
        type: "error"
      });
    } finally {
      setCaptchaLoading(false);
    }
  };

  useEffect(() => {
    refreshCaptcha();
    const currentYear = new Date().getFullYear();
    setAcademicYear(`${currentYear}-${(currentYear + 1).toString().slice(-2)}`);
  }, []);

  const handleCaptchaLoad = () => setCaptchaLoading(false);
  const handleCaptchaError = () => setCaptchaLoading(false);
  const closeToast = () => setToast(prev => ({ ...prev, show: false }));

  const handleLogin = async () => {
    if (!username || !password || !captcha || !semester || !academicYear) {
      setToast({
        show: true,
        message: "Please fill all fields.",
        type: "error"
      });
      return;
    }

    try {
      setIsLoggingIn(true);
      const form = getFormData(username, password, captcha, semester, academicYear, sessionId);
      const res = await axios.post(API_CONFIG.FETCH_URL, form);
      
      if (res.data.success) {
        saveCredentials({ username, password });
        localStorage.setItem("timetable", JSON.stringify(res.data.timetable));
        localStorage.setItem("semester", semester);
        localStorage.setItem("academicYear", academicYear);
        navigate("/home");
      } else {
        let message = res.data.message || "Login failed.";
        const lowerCaseMessage = message.toLowerCase();
        if (
          lowerCaseMessage.includes("invalid") ||
          lowerCaseMessage.includes("credential") ||
          lowerCaseMessage.includes("password")
        ) {
          message = "Password wrong. Please check your username and password.";
        }

        setToast({ show: true, message, type: "error" });
        refreshCaptcha();
      }
    } catch (error) {
      let errorMessage =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        "Something went wrong.";

      if (error.response?.status === 500) {
        errorMessage = "Password wrong. Please check your username and password.";
      } else if (
        errorMessage.toLowerCase().includes("invalid") ||
        errorMessage.toLowerCase().includes("credential") ||
        errorMessage.toLowerCase().includes("unauthorized")
      ) {
        errorMessage = "Password wrong. Please check your username and password.";
      }
      
      setToast({
        show: true,
        message: errorMessage,
        type: "error"
      });
      refreshCaptcha();
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <>
      <div className="login-header">
        <div className="login-header-content">
          <h1>TimeTable</h1>
          <ThemeToggle />
        </div>
      </div>

      <div className="container">
        <div className="text-center mb-20">
          <h1>Login to ERP</h1>
        </div>

        <div className="card">
          <div className="mb-16">
            <input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mb-16"
            />

            <input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-16"
            />

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="semester">Semester</label>
                <select
                  id="semester"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="form-select"
                >
                  <option value="odd">Odd Semester</option>
                  <option value="even">Even Semester</option>
                  <option value="summer">Summer Semester</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="academicYear">Academic Year</label>
                <select
                  id="academicYear"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="form-select"
                >
                  {getCurrentAcademicYearOptions().map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="captcha-container">
            <p className="mb-16">
              CAPTCHA takes a few seconds to load. Please wait and be patient after clicking login.
            </p>

            <div
              style={{
                width: "150px",
                height: "50px",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-tertiary)",
              }}
            >
              {captchaUrl ? (
                <img
                  src={captchaUrl}
                  alt="CAPTCHA"
                  className="captcha-image"
                  style={{ 
                    maxWidth: "100%", 
                    maxHeight: "100%", 
                    display: captchaLoading ? "none" : "block",
                    objectFit: "contain"
                  }}
                  onLoad={handleCaptchaLoad}
                  onError={handleCaptchaError}
                />
              ) : (
                <span>No image URL</span>
              )}
              {captchaLoading && <span>Loading CAPTCHA...</span>}
            </div>

            <button
              onClick={refreshCaptcha}
              className="mb-16"
              style={{ fontSize: "14px", padding: "8px 16px" }}
            >
              Reload CAPTCHA
            </button>

            <input
              placeholder="Enter CAPTCHA"
              value={captcha}
              onChange={(e) => setCaptcha(e.target.value)}
              className="captcha-input"
            />
          </div>

          <button onClick={handleLogin} className="primary full-width-mobile" disabled={isLoggingIn}>
            {isLoggingIn ? "Logging in..." : "Login"}
          </button>
        </div>
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={closeToast}
      />
    </>
  );
}
