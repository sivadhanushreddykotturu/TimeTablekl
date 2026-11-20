import React from "react";
import { NeoModal } from "../neo/Shell.jsx";
import AttendanceCalculator from "../neo/components/AttendanceCalculator.jsx";

/** The manual calculator as a sheet. `modeSwitch` is the Planner / Manual toggle shown above it. */
export default function CalculatorModal({ isOpen, onClose, initialCourseData, modeSwitch = null }) {
  return (
    <NeoModal open={isOpen} title="Plan bunks" onClose={onClose}>
      <div className="bc">
        {modeSwitch}
        <AttendanceCalculator initialComponents={initialCourseData} />
      </div>
    </NeoModal>
  );
}
