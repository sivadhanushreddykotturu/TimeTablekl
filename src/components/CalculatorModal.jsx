import React, { useState } from "react";

export default function CalculatorModal({ isOpen, onClose }) {
  const [attendedClasses, setAttendedClasses] = useState("");
  const [totalClasses, setTotalClasses] = useState("");
  const [percentage, setPercentage] = useState(null);
  const [error, setError] = useState("");

  // Multi-component percentage averaging (max 4 components)
  const [componentPercents, setComponentPercents] = useState([""]);
  const [averagePercent, setAveragePercent] = useState(null);
  const [avgError, setAvgError] = useState("");

  const recalcPercentage = (attendedStr, totalStr) => {
    setError("");
    setPercentage(null);

    const attended = Number(attendedStr);
    const total = Number(totalStr);

    if (!attendedStr && !totalStr) return;
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
    setPercentage(Math.ceil(raw));
  };

  const clear = () => {
    setAttendedClasses("");
    setTotalClasses("");
    setPercentage(null);
    setError("");
  };

  const addComponent = () => {
    if (componentPercents.length >= 4) return;
    setComponentPercents([...componentPercents, ""]);
  };

  const removeComponent = (index) => {
    if (componentPercents.length <= 1) return;
    const next = componentPercents.filter((_, i) => i !== index);
    setComponentPercents(next);
  };

  const updateComponent = (index, value) => {
    const next = [...componentPercents];
    next[index] = value;
    setComponentPercents(next);
  };
  
  const recalcAverage = (values) => {
    setAvgError("");
    setAveragePercent(null);
    if (!values.length) return;
    if (values.length > 4) {
      setAvgError("Max 4 components");
      return;
    }
    const nums = values.map(v => Number(v));
    if (nums.some(v => !Number.isFinite(v))) {
      setAvgError("Enter valid numbers");
      return;
    }
    if (nums.some(v => v < 0 || v > 100)) {
      setAvgError("Each % must be between 0 and 100");
      return;
    }
    const sum = nums.reduce((a, b) => a + b, 0);
    const avg = sum / nums.length;
    setAveragePercent(Math.ceil(avg));
  };

  const clearAverage = () => {
    setComponentPercents([""]);
    setAveragePercent(null);
    setAvgError("");
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
          {/* Single subject attendance calculator */}
          <div className="form-group" style={{ marginBottom: "12px" }}>
            <label htmlFor="attended" style={{ display: "block", marginBottom: "6px" }}>Attended classes</label>
            <input
              id="attended"
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="e.g., 5"
              value={attendedClasses}
              onChange={(e) => {
                const val = e.target.value;
                setAttendedClasses(val);
                recalcPercentage(val, totalClasses);
              }}
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
              onChange={(e) => {
                const val = e.target.value;
                setTotalClasses(val);
                recalcPercentage(attendedClasses, val);
              }}
            />
          </div>

          {error && (
            <div style={{ color: "#dc3545", fontSize: "14px", marginBottom: "12px" }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "8px" }}>
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

          {/* Divider */}
          <div style={{ height: 1, background: "var(--border-light)", margin: "16px 0" }}></div>

          {/* Multi-component average percentage */}
          <div style={{ marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>Total Attendance (Average %)</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Up to 4 components</div>
          </div>

          {componentPercents.map((val, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="100"
                placeholder={`Component ${idx + 1} %`}
                value={val}
                onChange={(e) => {
                  updateComponent(idx, e.target.value);
                  recalcAverage(componentPercents.map((v, i) => i === idx ? e.target.value : v));
                }}
              />
              <button
                className="secondary"
                onClick={() => removeComponent(idx)}
                disabled={componentPercents.length <= 1}
                style={{ minWidth: 44 }}
              >
                −
              </button>
              {idx === componentPercents.length - 1 && componentPercents.length < 4 && (
                <button className="primary" onClick={() => { addComponent(); }} style={{ minWidth: 44 }}>+</button>
              )}
            </div>
          ))}

          {avgError && (
            <div style={{ color: "#dc3545", fontSize: "14px", marginBottom: "12px" }}>{avgError}</div>
          )}

          <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: 8 }}>
            <button onClick={clearAverage} className="secondary">Clear</button>
            {componentPercents.length < 4 && (
              <button className="primary" onClick={addComponent}>Add Component</button>
            )}
          </div>

          {averagePercent !== null && (
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
              Total Percentage: {averagePercent}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
