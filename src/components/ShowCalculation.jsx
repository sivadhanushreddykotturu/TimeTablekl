import React from "react";

export default function ShowCalculation({ isOpen, onClose, courseData }) {
  if (!isOpen || !courseData) return null;

  const LTPS_WEIGHTS = {
    L: 100,
    T: 100,
    P: 50,
    S: 25,
    O: 1,
  };

  // Calculate step-by-step breakdown
  const calculateBreakdown = () => {
    const steps = [];
    let weightedAttendedSum = 0;
    let weightedConductedSum = 0;

    courseData.sections.forEach((section) => {
      const componentType = section.ltps.charAt(0).toUpperCase();
      const weight = LTPS_WEIGHTS[componentType] || LTPS_WEIGHTS.O;

      const attended = parseInt(section.totalAttended || "0", 10);
      const conducted = parseInt(section.totalConducted || "0", 10);
      const tcbr = parseInt(section.tcbr || "0", 10);
      const adjustedAttended = (Number.isFinite(attended) ? attended : 0) + (tcbr > 0 ? tcbr : 0);
      const safeConducted = Number.isFinite(conducted) ? conducted : 0;

      if (safeConducted > 0) {
        const weightedAttended = adjustedAttended * weight;
        const weightedConducted = safeConducted * weight;

        weightedAttendedSum += weightedAttended;
        weightedConductedSum += weightedConducted;

        // Calculate individual percentage with ceiling
        const individualPercentage = safeConducted > 0 
          ? Math.ceil((adjustedAttended / safeConducted) * 100)
          : 0;

        steps.push({
          componentType,
          section: section.section,
          attended,
          conducted,
          tcbr,
          adjustedAttended,
          weight,
          weightedAttended,
          weightedConducted,
          individualPercentage,
        });
      }
    });

    const calculated = weightedConductedSum > 0 
      ? (weightedAttendedSum / weightedConductedSum) * 100 
      : 0;
    const finalPercentage = Math.ceil(Math.max(0, Math.min(100, calculated)));

    return {
      steps,
      weightedAttendedSum,
      weightedConductedSum,
      calculated,
      finalPercentage,
    };
  };

  const breakdown = calculateBreakdown();

  // Get style variables for dark/light mode
  const getStyleVars = () => {
    let isDarkMode = false;
    try {
      const themeAttr = document.documentElement.getAttribute("data-theme");
      if (themeAttr) {
        isDarkMode = themeAttr.toLowerCase() === "dark";
      } else if (window.matchMedia) {
        isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
      }
    } catch (_) {}
    return {
      "--text-primary": isDarkMode ? "#f8f9fa" : "#212529",
      "--text-secondary": isDarkMode ? "#adb5bd" : "#6c757d",
      "--card-bg": isDarkMode ? "#1f1f1f" : "#ffffff",
      "--bg-secondary": isDarkMode ? "#2a2a2a" : "#f8f9fa",
      "--border-color": isDarkMode ? "#3a3a3a" : "#dee2e6",
      "--border-light": isDarkMode ? "#444" : "#e9ecef",
      "--overlay-bg": isDarkMode ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)",
      "--primary-color": "#007bff",
    };
  };

  const styleVars = getStyleVars();

  return (
    <div
      style={{
        ...styleVars,
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "var(--overlay-bg)",
        backdropFilter: "blur(5px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          padding: "20px",
          minWidth: "320px",
          maxWidth: "500px",
          maxHeight: "80vh",
          margin: "20px",
          overflowY: "auto",
          fontFamily: "Inter, ui-sans-serif, system-ui",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 4px 0", color: "var(--text-primary)", fontSize: "1.1rem" }}>
              {courseData.courseName}
            </h3>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
              {courseData.courseCode}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "24px",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: "0",
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "var(--bg-secondary)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "transparent";
            }}
          >
            ×
          </button>
        </div>

        {breakdown.steps.map((step, index) => (
          <div
            key={index}
            style={{
              background: "var(--bg-secondary)",
              padding: "10px",
              borderRadius: "6px",
              marginBottom: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span
                style={{
                  background: "var(--primary-color)",
                  color: "white",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
              >
                {step.componentType}
              </span>
              <span style={{ color: "var(--text-primary)", fontSize: "0.85rem" }}>
                {step.section}
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              {step.adjustedAttended}/{step.conducted} × {step.weight} = {step.weightedAttended} / {step.weightedConducted} = {step.individualPercentage}%
            </div>
          </div>
        ))}

        <div
          style={{
            background: "var(--primary-color)",
            color: "white",
            padding: "12px",
            borderRadius: "8px",
            marginTop: "12px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "0.85rem", opacity: 0.9, marginBottom: "6px" }}>
            {breakdown.weightedAttendedSum} ÷ {breakdown.weightedConductedSum} × 100 = {breakdown.calculated.toFixed(2)}%
          </div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>
            Final: {breakdown.finalPercentage}%
          </div>
        </div>
      </div>
    </div>
  );
}

