import React, { useState } from "react";

export default function CalculatorModal({ isOpen, onClose }) {
  const [attendedClasses, setAttendedClasses] = useState("");
  const [totalClasses, setTotalClasses] = useState("");
  const [percentage, setPercentage] = useState(null);
  const [error, setError] = useState("");

  const calculatePercentage = () => {
    setError("");
    setPercentage(null);

    const attended = Number(attendedClasses);
    const total = Number(totalClasses);

    if (!Number.isFinite(attended) || !Number.isFinite(total)) {
      setError("Enter valid numbers");
      return;
    }

    if (total <= 0) {
      setError("Total must be > 0");
      return;
    }

    if (attended < 0 || attended > total) {
      setError("Attended must be between 0 and total");
      return;
    }

    const raw = (attended / total) * 100;
    const result = Math.ceil(raw);
    setPercentage(result);
  };

  const clear = () => {
    setAttendedClasses("");
    setTotalClasses("");
    setPercentage(null);
    setError("");
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
        className="calculator-modal"
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          padding: "20px",
          minWidth: "280px",
          maxWidth: "340px",
          margin: "20px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="calculator-header">
          <h3 style={{ margin: "0 0 8px 0", color: "var(--text-primary)" }}>
            Attendance Calculator
          </h3>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "12px" }}>
            Calculates ceil(attended / total × 100)
          </div>
        </div>

        <div className="calculator-body">
          <div className="form-group" style={{ marginBottom: "12px" }}>
            <label htmlFor="attended" style={{ display: "block", marginBottom: "6px" }}>Attended classes</label>
            <input
              id="attended"
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="e.g., 5"
              value={attendedClasses}
              onChange={(e) => setAttendedClasses(e.target.value)}
              className="mb-8"
            />
          </div>

          <div className="form-group" style={{ marginBottom: "12px" }}>
            <label htmlFor="total" style={{ display: "block", marginBottom: "6px" }}>Total classes</label>
            <input
              id="total"
              type="number"
              inputMode="numeric"
              min="1"
              placeholder="e.g., 8"
              value={totalClasses}
              onChange={(e) => setTotalClasses(e.target.value)}
            />
          </div>

          {error && (
            <div style={{ color: "#dc3545", fontSize: "14px", marginBottom: "12px" }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "8px" }}>
            <button onClick={calculatePercentage} className="primary">Calculate</button>
            <button onClick={clear} className="secondary">Clear</button>
          </div>

          {percentage !== null && (
            <div
              style={{
                marginTop: "16px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-light)",
                borderRadius: "8px",
                padding: "12px",
                textAlign: "center",
                color: "var(--text-primary)",
                fontWeight: 600,
                fontSize: "18px",
              }}
            >
              Percentage: {percentage}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
