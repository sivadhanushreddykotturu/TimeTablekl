import React, { useState, useEffect } from "react";
import axios from "axios";
import { getCredentials } from "../../utils/storage.js";
import { getSeatingFormData, API_CONFIG } from "../config/api.js";

export default function SeatingPlanModal({ isOpen, onClose, onSuccess }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setIsLoading(true);
    setError("");

    const creds = getCredentials();
    if (!creds) {
      setError("Session expired. Please log in again.");
      setIsLoading(false);
      return;
    }

    try {
      const form = getSeatingFormData(creds.username, creds.password, "", "");
      const res = await axios.post(API_CONFIG.SEATING_URL, form);
      
      if (res.data.success) {
        localStorage.setItem("seatingPlan", JSON.stringify(res.data.seating_plan));
        onSuccess(res.data.seating_plan);
        onClose();
      } else {
        setError(res.data.message || "Failed to resync. Please try again.");
      }
    } catch (error) {
      setError(error.response?.data?.detail || error.response?.data?.message || "Something went wrong. Please try again.");
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
          ReSync Seating Plan
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

