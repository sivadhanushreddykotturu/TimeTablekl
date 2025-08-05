import React, { useState, useEffect } from "react";
import axios from "axios";
import { getCredentials } from "../../utils/storage.js";
import { getCaptchaUrl, getFormData, API_CONFIG } from "../config/api.js";

export default function CaptchaModal({ isOpen, onClose, onSuccess }) {
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaUrl, setCaptchaUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [imageLoading, setImageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCaptchaInput("");
      setError("");
      setImageLoading(true);
      
      // Use centralized captcha URL generation
      const url = getCaptchaUrl();
      setCaptchaUrl(url);
      
      // Add a timeout to handle cases where image takes too long
      const timeout = setTimeout(() => {
        setImageLoading(false);
      }, 10000); // 10 seconds timeout
      
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!captchaInput.trim()) {
      setError("Please enter the CAPTCHA");
      return;
    }

    setIsLoading(true);
    setError("");

    const creds = getCredentials();
    if (!creds) {
      setError("Session expired. Please log in again.");
      setIsLoading(false);
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
        setError(res.data.message || "Invalid CAPTCHA. Please try again.");
        // Sync captcha image
        setCaptchaUrl(getCaptchaUrl());
        setCaptchaInput("");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setCaptchaUrl(getCaptchaUrl());
      setCaptchaInput("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshCaptcha = () => {
    setRefreshing(true);
    setImageLoading(true);
    setError("");
    
    const url = getCaptchaUrl();
    setCaptchaUrl(url);
    setCaptchaInput("");
    
    // Show syncing message for 15 seconds
    setTimeout(() => {
      setRefreshing(false);
    }, 15000);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
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
          maxWidth: "400px",
          width: "90%",
          textAlign: "center",
          margin: "20px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0, marginBottom: "20px" }}>
          Enter CAPTCHA to ReSync
        </h3>
        
        <div className="captcha-container">
        <div style={{ position: "relative", marginBottom: "15px" }}>
  {imageLoading && (
    <div className="captcha-loading" style={{ textAlign: "center" }}>
      Loading CAPTCHA...
    </div>
  )}

  <img
    src={captchaUrl}
    alt="CAPTCHA"
    className="captcha-image"
    style={{
      margin: "0 auto",
      display: imageLoading ? "none" : "block"
    }}
    onLoad={() => {
      setImageLoading(false);
    }}
    onError={() => {
      setImageLoading(false);
      setError("Failed to load CAPTCHA image");
    }}
  />
</div>

          
          {refreshing && (
            <div style={{ 
              fontSize: "12px", 
              color: "var(--accent-primary)", 
              marginBottom: "10px",
              textAlign: "center"
            }}>
              Wait for 15 seconds to load
            </div>
          )}
          
          <button
            onClick={handleRefreshCaptcha}
            style={{
              fontSize: "14px",
              padding: "8px 16px",
              marginBottom: "15px"
            }}
            disabled={isLoading || refreshing}
          >
            ReSync CAPTCHA
          </button>
        </div>

        <input
          type="text"
          placeholder="Enter CAPTCHA"
          value={captchaInput}
          onChange={(e) => setCaptchaInput(e.target.value)}
          style={{
            width: "100%",
            marginBottom: "15px",
          }}
          onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
          disabled={isLoading}
        />

        {error && (
          <div
            style={{
              color: "#dc3545",
              fontSize: "14px",
              marginBottom: "15px",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="primary"
          >
            {isLoading ? "Submitting..." : "Submit"}
          </button>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
} 