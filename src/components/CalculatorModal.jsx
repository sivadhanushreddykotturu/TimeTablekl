import React, { useState } from "react";

export default function CalculatorModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("percentage");
  const [attendedClasses, setAttendedClasses] = useState("");
  const [totalClasses, setTotalClasses] = useState("");
  const [percentage, setPercentage] = useState(null);
  const [error, setError] = useState("");

  // -------------------------------------------------------------------
  // ⚠️ MODIFIED LOGIC START ⚠️
  // Component structure to hold L-T-P-S percentage values and their labels
  const initialComponents = [
    { label: "Lecture (100%)", type: "L", weight: 100, value: "" },
    { label: "Tutorial (100%)", type: "T", weight: 100, value: "" }, // CHANGED weight and label
    { label: "Practical (50%)", type: "P", weight: 50, value: "" },
    { label: "Skilling (25%)", type: "S", weight: 25, value: "" },
  ];

  const [componentsData, setComponentsData] = useState(initialComponents);
  const [weightedAverage, setWeightedAverage] = useState(null); // State for the final weighted result
  const [compError, setCompError] = useState("");

  // Calculates the L-T-P-S Weighted Average dynamically
  const computeWeightedAverage = (currentComponents) => {
    let weightedSum = 0;
    let totalWeight = 0;

    currentComponents.forEach(comp => {
      // Only process if the value is a valid number
      const num = parseFloat(comp.value);

      if (!isNaN(num) && num >= 0 && num <= 100) {
        weightedSum += num * comp.weight;
        totalWeight += comp.weight;
      }
    });

    if (totalWeight === 0) {
      return null; // No valid components entered
    }

    const result = weightedSum / totalWeight;
    // Clamp the result between 0 and 100 and use Math.ceil for final display
    return Math.ceil(Math.max(0, Math.min(100, result)));
  };
  
  // Numeric input handler for L-T-P-S components
  const updateComponentValue = (index, rawValue) => {
    // Allow typing decimals; don't block mid-entry
    const normalized = rawValue.replace(/,/g, '.');
    let bounded = '';

    if (normalized === '') {
      bounded = '';
    } else if (/^\d*(\.)?\d*$/.test(normalized)) {
      let num = Number(normalized);
            
      if (!Number.isFinite(num)) {
        return; // ignore invalid characters
      }
      
      // Prevent numbers greater than 100, but allow typing '10.'
      if (num > 100) num = 100;
      if (num < 0) num = 0;
      
      // Keep two decimal places for better precision in the display if not an integer
      bounded = String(num);

      // Handle trailing dot if it's the last character
      if (normalized.endsWith('.') && !bounded.includes('.')) {
        bounded = normalized;
      }
    } else {
      return;
    }

    const nextComponents = componentsData.map((comp, i) => 
      i === index ? { ...comp, value: bounded } : comp
    );
    
    setComponentsData(nextComponents);
    // Calculate and set the weighted average immediately upon change
    setWeightedAverage(computeWeightedAverage(nextComponents));
  };
  // ⚠️ MODIFIED LOGIC END ⚠️
  // -------------------------------------------------------------------


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
    // Reset component state back to initial L-T-P-S structure with empty values
    setComponentsData(initialComponents.map(comp => ({ ...comp, value: "" })));
    setWeightedAverage(null);
    setCompError("");
  };

  // The following functions are no longer needed for the L-T-P-S logic but are kept for clarity
  // in removing the old logic.
  const updatePercent = () => {}; // Replaced by updateComponentValue
  const addPercentField = () => {}; // Not needed, fixed 4 components
  const removePercentField = () => {}; // Not needed, fixed 4 components
  const computePercentAverage = () => {}; // Replaced by computeWeightedAverage

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
            {/* Map over the fixed L-T-P-S components */}
            {componentsData.map((comp, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px", alignItems: "end", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "6px" }}>{comp.label} attendance (%)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="any"
                    value={comp.value}
                    onChange={(e) => updateComponentValue(i, e.target.value)}
                    placeholder="Enter percentage"
                  />
                </div>
              </div>
            ))}

            <div style={{ display: "flex", gap: "8px", marginTop: "4px", marginBottom: "8px", justifyContent: "center" }}>
              {/* Removed Add/Remove buttons as components are fixed */}
              <button type="button" className="secondary" onClick={clear}>Clear All</button>
            </div>

            {compError && (
              <div style={{ color: "#dc3545", fontSize: "14px", marginBottom: "12px" }}>{compError}</div>
            )}

            {/* Display the dynamically calculated weighted average */}
            {weightedAverage !== null && (
              <div style={{
                  marginTop: "8px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "8px",
                  padding: "12px",
                  textAlign: "center",
                  color: "var(--text-primary)",
                  fontWeight: 600,
                  fontSize: "18px",
                }}>
                Overall Weighted Average: {weightedAverage}%
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}