import React, { useState, useEffect } from "react";
import axios from "axios";
import { getCredentials } from "../../utils/storage.js";
import { getFormData, API_CONFIG } from "../config/api.js";

export default function CaptchaModal({ isOpen, onClose, onSuccess, friendCredentials = null }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setIsLoading(true);
    setError("");

    const creds = friendCredentials || getCredentials();
    if (!creds) {
      setError("Session expired. Please log in again.");
      setIsLoading(false);
      return;
    }

    const semester = friendCredentials ? friendCredentials.semester : (localStorage.getItem("semester") || "odd");
    const academicYear = friendCredentials ? friendCredentials.academicYear : (localStorage.getItem("academicYear") || "2024-25");

    try {
      const form = getFormData(creds.username, creds.password, "", semester, academicYear, "");
      const res = await axios.post(API_CONFIG.FETCH_URL, form);
      
      if (res.data.success) {
        if (!friendCredentials) {
          localStorage.setItem("timetable", JSON.stringify(res.data.timetable));
        }
        onSuccess(res.data.timetable);
        onClose();
      } else {
        setError(res.data.message || "Failed to resync. Please try again.");
      }
    } catch (error) {
      setError(error.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      handleSubmit();
    }
    // eslint-disable-next-line
  }, [isOpen]);

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
      onClick={!isLoading ? onClose : undefined}
    >
      <div
        className="card"
        style={{
          minWidth: 280,
          maxWidth: 320,
          margin: "20px",
          textAlign: "center"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0, marginBottom: "20px" }}>
          {friendCredentials ? `ReSync ${friendCredentials.name || 'Friend'}'s Timetable` : 'ReSync Timetable'}
        </h3>

        {isLoading ? (
          <div style={{ padding: "20px" }}>
            <p>Syncing in background...</p>
          </div>
        ) : error ? (
          <div style={{ color: "#dc3545", marginBottom: "15px" }}>
            {error}
          </div>
        ) : null}

        {!isLoading && (
          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button onClick={handleSubmit} className="primary">Retry</button>
            <button onClick={onClose} className="secondary">Close</button>
          </div>
        )}
      </div>
    </div>
  );
} 