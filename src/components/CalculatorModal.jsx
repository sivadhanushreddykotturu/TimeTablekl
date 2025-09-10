import React, { useState } from "react";

export default function CalculatorModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("percentage");
  const [attendedClasses, setAttendedClasses] = useState("");
  const [totalClasses, setTotalClasses] = useState("");
  const [percentage, setPercentage] = useState(null);
  const [error, setError] = useState("");
  const [components, setComponents] = useState([
    { attended: "", total: "" },
    { attended: "", total: "" },
  ]);
  const [compError, setCompError] = useState("");
  const [targetPercent, setTargetPercent] = useState("");
  const [neededClasses, setNeededClasses] = useState(null);
  const [targetError, setTargetError] = useState("");
  const [targetCongrats, setTargetCongrats] = useState("");

  const congratsMessages = [
    "🥳 Mission complete! Time to touch some grass 🌱",
    "⚡ You’re literally 100% overpowered. Chill now 🏖️",
    "🚀 Attendance secured. Launch party at your place?",
    "🦸‍♂️ You’re the Attendance Avenger. No classes can defeat you.",
    "🎯 Target smashed! Your teacher is probably jealous 😎",
    "🥵 Bro, you’re cooking! No more classes for you.",
    "📢 Breaking news: Student achieves impossible attendance. Retires immediately.",
    "💤 Your attendance is so good it’s putting us to sleep. Go nap.",
  ];

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
    setComponents([
      { attended: "", total: "" },
      { attended: "", total: "" },
    ]);
    setCompError("");
    setTargetPercent("");
    setNeededClasses(null);
    setTargetError("");
    setTargetCongrats("");
  };

  const updateComponent = (index, field, value) => {
    setComponents((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addComponent = () => {
    setComponents((prev) => [...prev, { attended: "", total: "" }]);
  };

  const removeComponent = (index) => {
    setComponents((prev) => prev.filter((_, i) => i !== index));
  };

  const computeComponentStats = () => {
    if (components.length === 0) return { percs: [], overall: null };

    const percs = [];
    for (const c of components) {
      const a = Number(c.attended);
      const t = Number(c.total);
      if (!Number.isFinite(a) || !Number.isFinite(t)) return { percs: [], overall: null };
      if (t <= 0 || a < 0 || a > t) return { percs: [], overall: null };
      const p = Math.ceil((a / t) * 100);
      percs.push(p);
    }
    const sum = percs.reduce((s, p) => s + p, 0);
    const overall = Math.ceil(sum / percs.length);
    return { percs, overall };
  };

  const calculateNeededClasses = () => {
    setTargetError("");
    setNeededClasses(null);
    setTargetCongrats("");

    const attended = Number(attendedClasses);
    const total = Number(totalClasses);
    const target = Number(targetPercent);

    if (!Number.isFinite(attended) || !Number.isFinite(total) || !Number.isFinite(target)) {
      setTargetError("Enter valid numbers");
      return;
    }
    if (total < 0 || attended < 0 || attended > total) {
      setTargetError("Check attended/total values");
      return;
    }
    if (target <= 0) {
      setNeededClasses(0);
      setTargetCongrats(congratsMessages[Math.floor(Math.random() * congratsMessages.length)]);
      return;
    }
    if (target >= 100) {
      if (total > 0 && attended === total) {
        setNeededClasses(0);
        setTargetCongrats(congratsMessages[Math.floor(Math.random() * congratsMessages.length)]);
      } else {
        setTargetError("100% not possible after any absence");
      }
      return;
    }

    const numerator = target * total - 100 * attended;
    const denominator = 100 - target;
    const rawNeeded = numerator <= 0 ? 0 : Math.ceil(numerator / denominator);
    setNeededClasses(rawNeeded);
    if (rawNeeded === 0) {
      setTargetCongrats(congratsMessages[Math.floor(Math.random() * congratsMessages.length)]);
    }
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
            <div
              role="tab"
              onClick={() => setActiveTab("target")}
              style={{
                padding: "6px 8px",
                cursor: "pointer",
                borderBottom: activeTab === "target" ? "2px solid var(--text-primary)" : "2px solid transparent",
                color: activeTab === "target" ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: activeTab === "target" ? 600 : 500,
              }}
            >
              Target
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
        )}

        {activeTab === "components" && (
          <div className="calculator-body">
            {components.map((c, i) => {
              const a = Number(c.attended);
              const t = Number(c.total);
              const valid = Number.isFinite(a) && Number.isFinite(t) && t > 0 && a >= 0 && a <= t;
              const perc = valid ? Math.ceil((a / t) * 100) : null;
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "8px", alignItems: "end", marginBottom: "8px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px" }}>Attended</label>
                    <input type="number" inputMode="numeric" min="0" value={c.attended} onChange={(e) => updateComponent(i, "attended", e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px" }}>Total</label>
                    <input type="number" inputMode="numeric" min="1" value={c.total} onChange={(e) => updateComponent(i, "total", e.target.value)} />
                  </div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <div style={{ minWidth: "40px", textAlign: "right", color: "var(--text-secondary)" }}>{perc !== null ? `${perc}%` : "—"}</div>
                    {components.length > 1 && (
                      <button type="button" className="secondary" onClick={() => removeComponent(i)} title="Remove">−</button>
                    )}
                  </div>
                </div>
              );
            })}

            <div style={{ display: "flex", gap: "8px", marginTop: "4px", marginBottom: "8px" }}>
              <button type="button" className="secondary" onClick={addComponent}>Add component</button>
              <button type="button" className="secondary" onClick={clear}>Clear</button>
            </div>

            {compError && (
              <div style={{ color: "#dc3545", fontSize: "14px", marginBottom: "12px" }}>{compError}</div>
            )}

            {(() => {
              const { overall } = computeComponentStats();
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
                  Component-wise Average: {overall}%
                </div>
              ) : null;
            })()}
          </div>
        )}

        {activeTab === "target" && (
          <div className="calculator-body">
            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label htmlFor="attended2" style={{ display: "block", marginBottom: "6px" }}>Attended classes</label>
              <input
                id="attended2"
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="e.g., 5"
                value={attendedClasses}
                onChange={(e) => setAttendedClasses(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label htmlFor="total2" style={{ display: "block", marginBottom: "6px" }}>Total classes</label>
              <input
                id="total2"
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="e.g., 8"
                value={totalClasses}
                onChange={(e) => setTotalClasses(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label htmlFor="target" style={{ display: "block", marginBottom: "6px" }}>Target percentage</label>
              <input
                id="target"
                type="number"
                inputMode="numeric"
                min="1"
                max="100"
                placeholder="e.g., 75"
                value={targetPercent}
                onChange={(e) => setTargetPercent(e.target.value)}
              />
            </div>

            {targetError && (
              <div style={{ color: "#dc3545", fontSize: "14px", marginBottom: "12px" }}>{targetError}</div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "8px" }}>
              <button onClick={calculateNeededClasses} className="primary">Compute</button>
              <button onClick={clear} className="secondary">Clear</button>
            </div>

            {neededClasses !== null && targetError === "" && (
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
                }}
              >
                {neededClasses === 0 && targetCongrats
                  ? (<span>{targetCongrats}</span>)
                  : (<span>Attend next {neededClasses} class{neededClasses === 1 ? "" : "es"} to reach {targetPercent}%</span>)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
