import React, { useState, useEffect } from "react";
import axios from "axios";
import { getCredentials } from "../../utils/storage.js";
import { getSeatingFormData, API_CONFIG } from "../config/api.js";

export default function SeatingPlanModal({ isOpen, onClose, onSuccess }) {
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaUrl, setCaptchaUrl] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [imageLoading, setImageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCaptcha = async () => {
    setImageLoading(true);
    setError("");
    
    try {
      const response = await axios.get(API_CONFIG.CAPTCHA_URL, {
        responseType: 'blob'
      });
      
      const sessionIdFromHeader = response.headers['x-session-id'] || 
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
      setError("Failed to load CAPTCHA");
    } finally {
      setImageLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCaptchaInput("");
      setError("");
      loadCaptcha();
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!captchaInput.trim()) {
      setError("Please enter the CAPTCHA");
      return;
    }

    if (!sessionId) {
      setError("CAPTCHA not loaded. Please try again.");
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

    try {
      const form = getSeatingFormData(creds.username, creds.password, captchaInput, sessionId);
      const res = await axios.post(API_CONFIG.SEATING_URL, form);
      
      if (res.data.success) {
        localStorage.setItem("seatingPlan", JSON.stringify(res.data.seating_plan));
        onSuccess(res.data.seating_plan);
        onClose();
      } else {
        setError(res.data.message || "Invalid CAPTCHA. Please try again.");
        loadCaptcha();
        setCaptchaInput("");
      }
    } catch (error) {
      setError(error.response?.data?.detail || error.response?.data?.message || "Something went wrong. Please try again.");
      loadCaptcha();
      setCaptchaInput("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshCaptcha = async () => {
    setRefreshing(true);
    setError("");
    setCaptchaInput("");
    
    await loadCaptcha();
    
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
        <h3 style={{ marginTop: 0, marginBottom: "20px" }}>
          ReSync Seating Plan
        </h3>
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
            {imageLoading ? (
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

