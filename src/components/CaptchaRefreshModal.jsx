import React, { useEffect, useState } from "react";
import axios from "axios";
import { getCredentials } from "../utils/storage";
import { getCaptchaUrl, getFormData, API_CONFIG } from "../config/api.js";

export default function CaptchaRefreshModal({ onClose, onSuccess }) {
  const [captchaUrl, setCaptchaUrl] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setCaptchaUrl(getCaptchaUrl());
  }, []);

  const handleCaptchaLoad = () => {
    setCaptchaLoading(false);
  };

  const handleCaptchaError = () => {
    setCaptchaLoading(false);
  };

  const handleRefresh = async () => {
    const creds = getCredentials();
    if (!creds) {
      setError("No saved credentials. Please login again.");
      setTimeout(() => onClose(), 2000);
      return;
    }

    if (!captchaInput.trim()) {
      setError("Please enter the CAPTCHA");
      return;
    }

    // Get stored semester and academic year
    const storedSemester = localStorage.getItem("semester") || "odd";
    const storedAcademicYear = localStorage.getItem("academicYear") || "2024-25";

    try {
      const form = getFormData(creds.username, creds.password, captchaInput, storedSemester, storedAcademicYear);
      const res = await axios.post(API_CONFIG.FETCH_URL, form);
      
      if (res.data.success) {
        localStorage.setItem("timetable", JSON.stringify(res.data.timetable));
        onSuccess(res.data.timetable);
        onClose();
      } else {
        setError(res.data.message || "ReSync failed");
        setCaptchaUrl(getCaptchaUrl());
        setCaptchaInput("");
      }
    } catch {
      setError("Error syncing timetable");
      setCaptchaUrl(getCaptchaUrl());
      setCaptchaInput("");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(5px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          minWidth: 280,
          maxWidth: 320,
          margin: "20px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0, marginBottom: "20px" }}>ReSync Timetable</h3>
        <p className="mb-16">Enter the new CAPTCHA:</p>

        <div className="captcha-container">
          {captchaLoading ? (
            <div className="captcha-loading">
              Loading CAPTCHA...
            </div>
          ) : (
            <img
              src={captchaUrl}
              alt="CAPTCHA"
              className="captcha-image"
              onLoad={handleCaptchaLoad}
              onError={handleCaptchaError}
            />
          )}

          <input
            placeholder="Type CAPTCHA"
            value={captchaInput}
            onChange={(e) => setCaptchaInput(e.target.value)}
            className="captcha-input"
            onKeyPress={(e) => e.key === "Enter" && handleRefresh()}
          />
        </div>

        {error && (
          <div
            style={{
              color: "#dc3545",
              fontSize: "14px",
              marginBottom: "15px",
              textAlign: "center"
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button onClick={onClose} className="secondary">
            Cancel
          </button>
          <button onClick={handleRefresh} className="primary">
            ReSync
          </button>
        </div>
      </div>
    </div>
  );
}
