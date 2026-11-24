import React from "react";
import { NeoModal } from "../neo/Shell.jsx";

// How much each component counts towards the subject's overall percentage.
const WEIGHTS = { L: 100, T: 100, P: 50, S: 25 };
const NAMES = { L: "Lecture", T: "Tutorial", P: "Practical", S: "Skill" };

/** Works through a subject's overall percentage the way ERP does, one component at a time. */
function buildBreakdown(courseData, includeTcbr) {
  const steps = [];
  let attendedSum = 0;
  let conductedSum = 0;

  courseData.sections.forEach((section) => {
    const type = section.ltps.charAt(0).toUpperCase();
    const weight = WEIGHTS[type] || 1;
    const attended = parseInt(section.totalAttended || "0", 10) || 0;
    const conducted = parseInt(section.totalConducted || "0", 10) || 0;
    const tcbr = Math.max(0, parseInt(section.tcbr || "0", 10) || 0);
    const counted = Math.max(0, conducted - (includeTcbr ? tcbr : 0));
    if (counted <= 0) return;

    attendedSum += attended * weight;
    conductedSum += counted * weight;
    steps.push({ type, weight, attended, conducted, tcbr, counted });
  });

  const exact = conductedSum > 0 ? (attendedSum / conductedSum) * 100 : 0;
  return { steps, attendedSum, conductedSum, exact, final: Math.ceil(Math.max(0, Math.min(100, exact))) };
}

export default function ShowCalculation({ isOpen, onClose, courseData, includeTcbr = true, onToggleTcbr }) {
  if (!isOpen || !courseData) return null;

  const { steps, attendedSum, conductedSum, exact, final } = buildBreakdown(courseData, includeTcbr);
  const hasTcbr = steps.some((step) => step.tcbr > 0);

  return (
    <NeoModal open title="How it's calculated" onClose={onClose}>
      <p className="np-note" style={{ marginBottom: 16 }}>
        Each component's classes are multiplied by its weight, then attended is divided by conducted.
      </p>

      <div className="np-reglist">
        {steps.map((step, index) => (
          <div key={index} className="np-reglist__row">
            <span>
              {NAMES[step.type] || step.type} <small>× {step.weight}</small>
              {step.tcbr > 0 && (
                <small>
                  {" "}· TCBR {step.tcbr} {includeTcbr ? "removed" : "ignored"}
                </small>
              )}
            </span>
            <b>
              {step.attended} / {step.counted}
            </b>
          </div>
        ))}
        <div className="np-reglist__row">
          <span>Weighted total</span>
          <b>
            {attendedSum} / {conductedSum}
          </b>
        </div>
        <div className="np-reglist__row">
          <span>
            Overall <small>· {exact.toFixed(2)}% rounded up</small>
          </span>
          <b>{final}%</b>
        </div>
      </div>

      {hasTcbr && onToggleTcbr && (
        <button
          type="button"
          className={`np-chipbtn${includeTcbr ? " is-on" : ""}`}
          role="switch"
          aria-checked={includeTcbr}
          style={{ marginTop: 16 }}
          onClick={onToggleTcbr}
        >
          TCBR {includeTcbr ? "on" : "off"}
        </button>
      )}
    </NeoModal>
  );
}
