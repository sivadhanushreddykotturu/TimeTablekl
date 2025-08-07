import React, { useEffect, useState } from "react";
import axios from "axios";
import { getCredentials } from "../utils/storage";
import { getFormData, API_CONFIG } from "../config/api.js";

export default function CaptchaRefreshModal({ onClose, onSuccess }) {
  const [captchaUrl, setCaptchaUrl] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCaptcha = async () => {
    setCaptchaLoading(true);
    setError("");
    
    try {
      const response = await axios.get(API_CONFIG.CAPTCHA_URL, {
        responseType: 'blob' // Important: get the image as blob
      });
      
      // Get session ID from response headers (try different cases)
      const sessionIdFromHeader = response.headers['x-session-id'] || 
                                 response.headers['X-Session-ID'] || 
                                 response.headers['X-SESSION-ID'];
      
      if (sessionIdFromHeader) {
        setSessionId(sessionIdFromHeader);
      } else {
        // Fallback: use timestamp as session ID for new backend compatibility
        const fallbackSessionId = `session_${Date.now()}`;
        setSessionId(fallbackSessionId);
      }
      
      // Create object URL for the image
      const imageUrl = URL.createObjectURL(response.data);
      setCaptchaUrl(imageUrl);
      
    } catch (error) {
      setError("Failed to load CAPTCHA");
    } finally {
      setCaptchaLoading(false);
    }
  };

  useEffect(() => {
    loadCaptcha();
  }, []);

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

    if (!sessionId) {
      setError("CAPTCHA not loaded. Please try again.");
      return;
    }

    // Get stored semester and academic year
    const storedSemester = localStorage.getItem("semester") || "odd";
    const storedAcademicYear = localStorage.getItem("academicYear") || "2024-25";

    try {
      const form = getFormData(creds.username, creds.password, captchaInput, storedSemester, storedAcademicYear, sessionId);
      const res = await axios.post(API_CONFIG.FETCH_URL, form);
      
      if (res.data.success) {
        localStorage.setItem("timetable", JSON.stringify(res.data.timetable));
        onSuccess(res.data.timetable);
        onClose();
      } else {
        setError(res.data.message || "ReSync failed");
        loadCaptcha();
        setCaptchaInput("");
      }
    } catch (error) {
      setError(error.response?.data?.message || "Error syncing timetable");
      loadCaptcha();
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
            {captchaLoading ? (
              <span>Loading CAPTCHA...</span>
            ) : captchaUrl ? (
              <img
                src={captchaUrl}
                alt="CAPTCHA"
                className="captcha-image"
                style={{ maxWidth: "100%", maxHeight: "100%" }}
              />
            ) : (
              <span>Failed to load</span>
            )}
          </div>

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
