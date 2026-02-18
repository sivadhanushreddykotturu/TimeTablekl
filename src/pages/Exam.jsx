import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import SeatingPlanModal from "../components/SeatingPlanModal";
import EditSlotModal from "../components/EditSlotModal";
import Toast from "../components/Toast";
import { getCredentials } from "../../utils/storage.js";
import { getSubjectName } from "../utils/subjectMapper";
import { getSlotDetails } from "../utils/examSlots";

const minutes = (hours, mins) => hours * 60 + mins;

const getSlotInfo = (examType = "", slot = "", slotDetails) => {
  const normalizedSlot = slot.toUpperCase();
  const isEndSemester = examType.toLowerCase().includes("end");

  if (isEndSemester) {
    return {
      label: normalizedSlot || "N/A",
      endMinutes: null,
    };
  }

  return (
    slotDetails.inSemester[normalizedSlot] || {
      label: slot || "N/A",
      endMinutes: null,
    }
  );
};

function findTodayAndNextExam(seatingPlan, slotDetails) {
  if (!seatingPlan || seatingPlan.length === 0) {
    return { todayExam: null, nextExam: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  // Sort seating plan by date (ascending - future first), then by time slot
  const sortedPlan = [...seatingPlan].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    if (dateA.getTime() !== dateB.getTime()) {
      return dateA.getTime() - dateB.getTime(); // Ascending: future dates come later
    }
    const timeOrder = { AM: 1, MN: 1, MO: 1, FN: 2, PM: 3, EN: 4, AN: 5 };
    const slotA = (a.time_slot || "").toUpperCase();
    const slotB = (b.time_slot || "").toUpperCase();
    return (timeOrder[slotA] || 0) - (timeOrder[slotB] || 0);
  });

  let todayExam = null;
  let nextExam = null;

  // Find today's exam (first exam today that hasn't ended)
  for (const exam of sortedPlan) {
    const examDate = new Date(exam.date);
    examDate.setHours(0, 0, 0, 0);

    if (examDate.getTime() === today.getTime()) {
      const slotInfo = getSlotInfo(exam.exam_type, exam.time_slot, slotDetails);
      const slotEnd = slotInfo.endMinutes ?? minutes(23, 59);

      if (currentTime < slotEnd) {
        todayExam = exam;
        break;
      }
    }
  }

  // Find next exam (after today's exam, or first future exam if no exam today)
  for (const exam of sortedPlan) {
    const examDate = new Date(exam.date);
    examDate.setHours(0, 0, 0, 0);

    if (examDate.getTime() > today.getTime()) {
      nextExam = exam;
      break;
    } else if (examDate.getTime() === today.getTime() && exam !== todayExam) {
      const slotInfo = getSlotInfo(exam.exam_type, exam.time_slot, slotDetails);
      const slotEnd = slotInfo.endMinutes ?? minutes(23, 59);

      if (currentTime < slotEnd) {
        nextExam = exam;
        break;
      }
    }
  }

  // Format exam display
  const formatExam = (exam) => {
    if (!exam) return null;

    const subjectName = getSubjectName(exam.course_code);
    const displayName = subjectName !== exam.course_code ? subjectName : exam.course_code;
    const slotInfo = getSlotInfo(exam.exam_type, exam.time_slot, slotDetails);

    let timeSlot;
    if (slotDetails.isCustom) {
      timeSlot = slotInfo.label || exam.time_slot;
    } else {
      timeSlot = (exam.time_slot || "").toUpperCase();
    }

    const date = new Date(exam.date);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `${displayName} - ${exam.room_no} (${dateStr}, ${timeSlot})`;
  };

  return {
    todayExam: todayExam ? formatExam(todayExam) : null,
    nextExam: nextExam ? formatExam(nextExam) : null
  };
}

export default function Exam() {
  const navigate = useNavigate();
  const [seatingPlan, setSeatingPlan] = useState(
    JSON.parse(localStorage.getItem("seatingPlan") || "[]")
  );

  const [slotDetails, setSlotDetails] = useState(getSlotDetails());

  const [todayExam, setTodayExam] = useState(null);
  const [nextExam, setNextExam] = useState(null);
  const [showSeatingModal, setShowSeatingModal] = useState(false);
  const [showEditSlotsModal, setShowEditSlotsModal] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  useEffect(() => {
    localStorage.setItem("examMode", "true");

    const credentials = getCredentials();
    const timetable = localStorage.getItem("timetable");

    if (!credentials || !timetable) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const { todayExam: today, nextExam: next } = findTodayAndNextExam(seatingPlan, slotDetails);
    setTodayExam(today);
    setNextExam(next);
  }, [seatingPlan, slotDetails]);

  const handleRefresh = () => {
    setShowSeatingModal(true);
  };

  const handleSeatingSuccess = (newSeatingPlan) => {
    setSeatingPlan(newSeatingPlan);
    setToast({
      show: true,
      message: "Seating plan synced successfully!",
      type: "success"
    });
  };

  const handleSlotSave = (newDetails) => {
    setSlotDetails(newDetails);
    setToast({
      show: true,
      message: "Slot timings updated!",
      type: "success"
    });
  };

  const closeToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };

  return (
    <>
      <Header onRefresh={handleRefresh} />
      <div className="container">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">Exam Mode</h1>
          <button
            onClick={() => setShowEditSlotsModal(true)}
            style={{
              padding: "6px 12px",
              fontSize: "14px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              color: "var(--text-primary)",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Edit Slot Timings
          </button>
        </div>

        {todayExam && (
          <div className="class-card">
            <h2>Upcoming Exam</h2>
            <div className="class-card-content">
              {todayExam}
            </div>
          </div>
        )}

        {nextExam && (
          <div className="class-card">
            <h2>Following Exam</h2>
            <div className="class-card-content">
              {nextExam}
            </div>
          </div>
        )}

        {!todayExam && !nextExam && (
          <div
            style={{
              marginTop: "20px",
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid var(--border-color)",
              background: "var(--bg-secondary)",
              textAlign: "center",
              color: "var(--text-secondary)",
              fontWeight: 500,
            }}
          >
            If there are any exams scheduled, consider ReSyncing (top-right) to check for updates.
          </div>
        )}
      </div>

      <SeatingPlanModal
        isOpen={showSeatingModal}
        onClose={() => setShowSeatingModal(false)}
        onSuccess={handleSeatingSuccess}
      />

      <EditSlotModal
        isOpen={showEditSlotsModal}
        onClose={() => setShowEditSlotsModal(false)}
        onSave={handleSlotSave}
      />

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={closeToast}
      />
    </>
  );
}
