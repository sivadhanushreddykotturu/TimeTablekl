import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { saveCredentials, saveCookies } from "../../utils/storage.js";
import Toast from "../components/Toast.jsx";
import { getFormData, API_CONFIG, getCurrentAcademicYearOptions } from "../config/api.js";
import { NeoButton, NeoField, NeoSelect, NeoCard } from "./NeoKit.jsx";
import { Sparkle, LoginDecor } from "./Decor.jsx";
import "./neo.css";

export default function NeoLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [semester, setSemester] = useState("odd");
  const [academicYear, setAcademicYear] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const currentYear = new Date().getFullYear();
    setAcademicYear(`${currentYear}-${(currentYear + 1).toString().slice(-2)}`);
  }, []);

  const closeToast = () => setToast(prev => ({ ...prev, show: false }));

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!username || !password || !semester || !academicYear) {
      setToast({ show: true, message: "Please fill all fields.", type: "error" });
      return;
    }

    try {
      setIsLoggingIn(true);
      const form = getFormData(username, password, "", semester, academicYear, "");
      const res = await axios.post(API_CONFIG.FETCH_URL, form);

      if (res.data.success) {
        saveCredentials({ username, password });
        // Save session cookies from backend for self-healing routes
        if (res.data.cookies) {
          saveCookies(res.data.cookies);
        }
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

      setToast({ show: true, message: errorMessage, type: "error" });
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="np-screen">
      <LoginDecor />

      <main className="np-shell">
        {/* hero plaque */}
        <section className="np-plaque">
          <Sparkle className="np-plaque__star" size={34} color="#cfff04" />
          <div className="np-plaque__eyebrow">KL University · ERP companion</div>
          <h1 className="np-plaque__title">
            timetable<span className="np-dot">.</span>
          </h1>
          <div className="np-plaque__words">
            <em>young.</em>
            <em>playful.</em>
            <em>on time.</em>
          </div>
        </section>

        {/* form intro */}
        <div className="np-formhead">
          <span className="np-eyebrow">sign in</span>
          <p>Use your ERP username and password. They never leave this device.</p>
        </div>

        {/* form card */}
        <form onSubmit={handleLogin}>
          <NeoCard>
            <NeoField
              id="np-username"
              label="university id"
              placeholder="2400090000"
              value={username}
              autoComplete="username"
              onChange={(e) => setUsername(e.target.value)}
            />

            <NeoField
              id="np-password"
              label="password"
              type="password"
              placeholder="••••••••"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
            />

            <div className="np-row">
              <NeoSelect
                id="np-semester"
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
                id="np-year"
                label="academic year"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
              >
                {getCurrentAcademicYearOptions().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </NeoSelect>
            </div>
          </NeoCard>

          <NeoButton loading={isLoggingIn} loadingText="signing in…">
            sign in
          </NeoButton>
        </form>

        <p className="np-foot">
          local-first · <b>your data stays in this browser</b>
        </p>
      </main>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={closeToast}
      />
    </div>
  );
}
