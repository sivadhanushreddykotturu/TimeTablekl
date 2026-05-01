import React, { useEffect, useState } from "react";
import axios from "axios";
import { getCredentials } from "../utils/storage";
import { getFormData, API_CONFIG } from "../config/api.js";

export default function CaptchaRefreshModal({ onClose, onSuccess }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRefresh = async () => {
    setIsLoading(true);
    setError("");

    const creds = getCredentials();
    if (!creds) {
      setError("No saved credentials. Please login again.");
      setTimeout(() => onClose(), 2000);
      return;
    }

    const storedSemester = localStorage.getItem("semester") || "odd";
    const storedAcademicYear = localStorage.getItem("academicYear") || "2024-25";

    try {
      const form = getFormData(creds.username, creds.password, "", storedSemester, storedAcademicYear, "");
      const res = await axios.post(API_CONFIG.FETCH_URL, form);
      
      if (res.data.success) {
        localStorage.setItem("timetable", JSON.stringify(res.data.timetable));
        onSuccess(res.data.timetable);
        onClose();
      } else {
        setError(res.data.message || "ReSync failed");
      }
    } catch (error) {
      setError(error.response?.data?.message || "Error syncing timetable");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleRefresh();
    // eslint-disable-next-line
  }, []);

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
        <h3 style={{ marginTop: 0, marginBottom: "20px" }}>ReSync Timetable</h3>

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
            <button onClick={handleRefresh} className="primary">Retry</button>
            <button onClick={onClose} className="secondary">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
