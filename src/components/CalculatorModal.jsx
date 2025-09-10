import React, { useState } from "react";

export default function CalculatorModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("percentage");
  const [attendedClasses, setAttendedClasses] = useState("");
  const [totalClasses, setTotalClasses] = useState("");
  const [percentage, setPercentage] = useState(null);
  const [error, setError] = useState("");
  // Components: accept up to 4 percentage values and compute average (ceil)
  const [componentPercents, setComponentPercents] = useState(["", ""]);
  const [compError, setCompError] = useState("");

  const calculatePercentage = () => {
    setError("");
    setPercentage(null);

    const attendedStr = attendedClasses.trim();
    const totalStr = totalClasses.trim();
    if (!/^\d+$/.test(attendedStr) || !/^\d+$/.test(totalStr)) {
      setError("Only whole numbers allowed");
      return;
    }
    const attended = parseInt(attendedStr, 10);
    const total = parseInt(totalStr, 10);

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
    setComponentPercents(["", ""]);
    setCompError("");
  };

  const updatePercent = (index, value) => {
    // keep only digits, limit 0-100
    const sanitized = value.replace(/[^0-9]/g, "");
    const bounded = sanitized === "" ? "" : String(Math.min(100, parseInt(sanitized, 10)));
    setComponentPercents((prev) => {
      const next = [...prev];
      next[index] = bounded;
      return next;
    });
  };

  const addPercentField = () => {
    setComponentPercents((prev) => (prev.length < 4 ? [...prev, ""] : prev));
  };

  const removePercentField = (index) => {
    setComponentPercents((prev) => prev.filter((_, i) => i !== index));
  };

  const computePercentAverage = () => {
    const nums = componentPercents
      .map((v) => (v.trim() === "" ? null : parseInt(v, 10)))
      .filter((v) => v !== null && Number.isInteger(v) && v >= 0 && v <= 100);
    if (nums.length === 0) return null;
    const sum = nums.reduce((s, n) => s + n, 0);
    return Math.ceil(sum / nums.length);
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
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "8px",
              marginBottom: "12px",
              borderBottom: "1px solid var(--border-color)",
            }}
          >
            <div
              role="tab"
              onClick={() => setActiveTab("percentage")}
              style={{
                padding: "6px 8px",
                cursor: "pointer",
                borderBottom: activeTab === "percentage" ? "2px solid var(--text-primary)" : "2px solid transparent",
                color: activeTab === "percentage" ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: activeTab === "percentage" ? 600 : 500,
              }}
            >
              Percentage
            </div>
            <div
              role="tab"
              onClick={() => setActiveTab("components")}
              style={{
                padding: "6px 8px",
                cursor: "pointer",
                borderBottom: activeTab === "components" ? "2px solid var(--text-primary)" : "2px solid transparent",
                color: activeTab === "components" ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: activeTab === "components" ? 600 : 500,
              }}
            >
              Components
            </div>
          </div>
        </div>

        {activeTab === "percentage" && (
          <div className="calculator-body">
            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label htmlFor="attended" style={{ display: "block", marginBottom: "6px" }}>Attended classes</label>
              <input
                id="attended"
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                placeholder="e.g., 5"
                value={attendedClasses}
                onChange={(e) => setAttendedClasses(e.target.value.replace(/[^0-9]/g, ""))}
                className="mb-8"
              />
            </div>

            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label htmlFor="total" style={{ display: "block", marginBottom: "6px" }}>Total classes</label>
              <input
                id="total"
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                placeholder="e.g., 8"
                value={totalClasses}
                onChange={(e) => setTotalClasses(e.target.value.replace(/[^0-9]/g, ""))}
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
        )}

        {activeTab === "components" && (
          <div className="calculator-body">
            {componentPercents.map((val, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", alignItems: "end", marginBottom: "8px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "6px" }}>Component {i + 1} (%)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="100"
                    step="1"
                    value={val}
                    onChange={(e) => updatePercent(i, e.target.value)}
                    placeholder="e.g., 90"
                  />
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  {componentPercents.length > 1 && (
                    <button type="button" className="secondary" onClick={() => removePercentField(i)} title="Remove">−</button>
                  )}
                </div>
              </div>
            ))}

            <div style={{ display: "flex", gap: "8px", marginTop: "4px", marginBottom: "8px" }}>
              <button type="button" className="secondary" onClick={addPercentField} disabled={componentPercents.length >= 4}>Add component</button>
              <button type="button" className="secondary" onClick={clear}>Clear</button>
            </div>

            {compError && (
              <div style={{ color: "#dc3545", fontSize: "14px", marginBottom: "12px" }}>{compError}</div>
            )}

            {(() => {
              const overall = computePercentAverage();
              return overall !== null ? (
                <div style={{
                  marginTop: "8px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "8px",
                  padding: "12px",
                  textAlign: "center",
                  color: "var(--text-primary)",
                  fontWeight: 600,
                }}>
                  Average: {overall}%
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
