import React, { useState } from "react";

export default function CalculatorModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("percentage");
  const [attendedClasses, setAttendedClasses] = useState("");
  const [totalClasses, setTotalClasses] = useState("");
  const [percentage, setPercentage] = useState(null);
  const [error, setError] = useState("");
  const [isBunkCalculator, setIsBunkCalculator] = useState(false);
  const [requiredPercentage, setRequiredPercentage] = useState("");
  const [bunkResult, setBunkResult] = useState(null);

  const initialComponents = [
    { label: "Lecture (100%)", type: "L", weight: 100, value: "" },
    { label: "Tutorial (100%)", type: "T", weight: 100, value: "" },
    { label: "Practical (50%)", type: "P", weight: 50, value: "" },
    { label: "Skilling (25%)", type: "S", weight: 25, value: "" },
  ];
  const [componentsData, setComponentsData] = useState(initialComponents);
  const [weightedAverage, setWeightedAverage] = useState(null);
  const [compError, setCompError] = useState("");

  const computeWeightedAverage = (currentComponents) => {
    let weightedSum = 0;
    let totalWeight = 0;
    currentComponents.forEach(comp => {
      const num = parseFloat(comp.value);
      if (!isNaN(num) && num >= 0 && num <= 100) {
        weightedSum += num * comp.weight;
        totalWeight += comp.weight;
      }
    });
    if (totalWeight === 0) return null;
    const result = weightedSum / totalWeight;
    return Math.ceil(Math.max(0, Math.min(100, result)));
  };

  const updateComponentValue = (index, rawValue) => {
    const normalized = rawValue.replace(/,/g, '.');
    let bounded = '';
    if (normalized === '') {
      bounded = '';
    } else if (/^\d*(\.)?\d*$/.test(normalized)) {
      let num = Number(normalized);
      if (!Number.isFinite(num)) return;
      if (num > 100) num = 100;
      if (num < 0) num = 0;
      bounded = String(num);
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
    setWeightedAverage(computeWeightedAverage(nextComponents));
  };

  const reqAttendance = (present, total, percentage) => {
    const needed = (percentage * total - 100 * present) / (100 - percentage);
    return Math.ceil(needed);
  };

  const daysToBunk = (present, total, percentage) => {
    const available = (100 * present - percentage * total) / percentage;
    return Math.floor(available);
  };

  const calculateBunkClasses = () => {
    setError("");
    setBunkResult(null);
    setPercentage(null);

    const attendedStr = attendedClasses.trim();
    const totalStr = totalClasses.trim();
    const requiredStr = requiredPercentage.trim();

    if (!/^\d+$/.test(attendedStr) || !/^\d+$/.test(totalStr)) {
      setError("Attended/Total must be whole numbers.");
      return;
    }
    const requiredNum = parseFloat(requiredStr);
    if (!requiredStr || isNaN(requiredNum) || requiredNum < 0 || requiredNum > 100) {
      setError("Required Percentage must be between 0 and 100.");
      return;
    }
    
    const attended = parseInt(attendedStr, 10);
    const total = parseInt(totalStr, 10);
    const required = requiredNum;

    if (total <= 0) {
      setError("Total classes must be greater than 0.");
      return;
    }
    if (attended < 0 || attended > total) {
      setError("Attended must be between 0 and total.");
      return;
    }

    const currentPercent = (attended / total) * 100;
    const currentPercentFormatted = currentPercent.toFixed(2);

    if (currentPercent >= required) {
      const daysAvailableToBunk = daysToBunk(attended, total, required);
      let outputLine1 = `🟢 Attendance: ${currentPercentFormatted}%`;
      let outputLine2;

      if (daysAvailableToBunk < 0 || daysAvailableToBunk === 0) {
          outputLine2 = `🚫 Bunks Left: 0 (Must attend)`;
      } else {
          outputLine2 = `🕒 Bunks Left: ${daysAvailableToBunk}`;
      }
      
      setBunkResult(`${outputLine1}<br/>${outputLine2}`);
    } else {
      const attendanceNeeded = reqAttendance(attended, total, required);
      let outputLine1 = `🔴 Attendance: ${currentPercentFormatted}%`;
      let outputLine2;

      if (!Number.isFinite(attendanceNeeded) || attendanceNeeded < 0) {
          outputLine2 = `❌ Attend Required: Goal Unrealistic`;
      } else {
          outputLine2 = `⬆️ Attend Required: ${attendanceNeeded}`;
      }
      
      setBunkResult(`${outputLine1}<br/>${outputLine2}`);
    }
  };

  const calculatePercentage = () => {
    setError("");
    setPercentage(null);
    setBunkResult(null);

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
    const result = raw.toFixed(2); 
    setPercentage(result);
  };

  const handleCalculateClick = () => {
    if (isBunkCalculator) {
        calculateBunkClasses();
    } else {
        calculatePercentage();
    }
  }

  const clear = () => {
    setAttendedClasses("");
    setTotalClasses("");
    setPercentage(null);
    setError("");
    setRequiredPercentage(""); 
    setBunkResult(null); 
    setComponentsData(initialComponents.map(comp => ({ ...comp, value: "" })));
    setWeightedAverage(null);
    setCompError("");
  };

  const updatePercent = () => {}; 
  const addPercentField = () => {}; 
  const removePercentField = () => {}; 
  const computePercentAverage = () => {};

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
            <div 
                style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    marginBottom: '16px',
                    padding: '8px 0',
                    borderBottom: "1px solid var(--border-color)",
                }}
            >
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Bunk Calculator</span>
                <button 
                    onClick={() => setIsBunkCalculator(!isBunkCalculator)}
                    style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: 'none',
                        fontWeight: 500,
                        backgroundColor: isBunkCalculator ? 'var(--primary-color)' : 'var(--border-color)',
                        color: isBunkCalculator ? 'white' : 'var(--text-primary)',
                        transition: 'background-color 0.2s',
                    }}
                >
                    {isBunkCalculator ? 'ON' : 'OFF'}
                </button>
            </div>
            
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
            
            {isBunkCalculator && (
                <div className="form-group" style={{ marginBottom: "12px" }}>
                    <label htmlFor="required-percent" style={{ display: "block", marginBottom: "6px" }}>Required Percentage (%)</label>
                    <input
                        id="required-percent"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="e.g., 75.0"
                        value={requiredPercentage}
                        onChange={(e) => setRequiredPercentage(e.target.value)}
                    />
                </div>
            )}
            
            {error && (
              <div style={{ color: "#dc3545", fontSize: "14px", marginBottom: "12px" }}>{error}</div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "8px" }}>
              <button onClick={handleCalculateClick} className="primary">
                {isBunkCalculator ? 'Calculate Bunk' : 'Calculate Percentage'}
              </button>
              <button onClick={clear} className="secondary">Clear</button>
            </div>
            
            {isBunkCalculator && bunkResult !== null && (
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
                    dangerouslySetInnerHTML={{ __html: bunkResult }}
                />
            )}

            {!isBunkCalculator && percentage !== null && (
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
            {componentsData.map((comp, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px", alignItems: "end", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "6px" }}>{comp.label} </label>
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
              <button type="button" className="secondary" onClick={clear}>Clear All</button>
            </div>

            {compError && (
              <div style={{ color: "#dc3545", fontSize: "14px", marginBottom: "12px" }}>{compError}</div>
            )}

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
                Overall Average: {weightedAverage}%
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
