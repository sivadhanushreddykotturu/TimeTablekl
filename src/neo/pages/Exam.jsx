import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import NeoShell from "../Shell.jsx";
import SeatingPlanModal from "../../components/SeatingPlanModal";
import EditSlotModal from "../../components/EditSlotModal";
import Toast from "../../components/Toast.jsx";
import { getCredentials } from "../../../utils/storage.js";
import { getSubjectName } from "../../utils/subjectMapper";
import { getSlotDetails } from "../../utils/examSlots";

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

  const sortedPlan = [...seatingPlan].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    if (dateA.getTime() !== dateB.getTime()) {
      return dateA.getTime() - dateB.getTime();
    }
    const timeOrder = { AM: 1, MN: 1, MO: 1, FN: 2, PM: 3, EN: 4, AN: 5 };
    const slotA = (a.time_slot || "").toUpperCase();
    const slotB = (b.time_slot || "").toUpperCase();
    return (timeOrder[slotA] || 0) - (timeOrder[slotB] || 0);
  });

  let todayExam = null;
  let nextExam = null;

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

    return {
      name: displayName,
      room: exam.room_no,
      when: `${dateStr} · ${timeSlot}`,
    };
  };

  return {
    todayExam: todayExam ? formatExam(todayExam) : null,
    nextExam: nextExam ? formatExam(nextExam) : null
  };
}

export default function NeoExam() {
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

  return (
    <NeoShell onRefresh={handleRefresh} refreshMode="direct" refreshLabel="seating" examExit>
      <div className="np-pagehead">
        <span className="np-eyebrow np-eyebrow--acid">exam mode on</span>
        <div className="np-pagehead__row">
          <h1 className="np-pagehead__title">exams<i>.</i></h1>
          <button className="np-iconbtn" onClick={() => setShowEditSlotsModal(true)}>
            edit slots
          </button>
        </div>
      </div>

      {todayExam && (
        <section className="np-now">
          <div className="np-now__label">
            <span className="np-now__pulse" />
            upcoming exam
          </div>
          <div className="np-now__class">{todayExam.name}</div>
          <div className="np-now__time">room {todayExam.room} · {todayExam.when}</div>
        </section>
      )}

      {nextExam && (
        <section className="np-next">
          <span className="np-next__label">then</span>
          <div className="np-next__body">
            <div className="np-next__class">{nextExam.name}</div>
            <div className="np-next__time">room {nextExam.room} · {nextExam.when}</div>
          </div>
        </section>
      )}

      {!todayExam && !nextExam && (
        <div className="np-empty">
          <h2 className="np-empty__title">no exams found</h2>
          <p className="np-empty__text">
            If exams are scheduled, hit "seating" up top to pull the latest seating plan.
          </p>
        </div>
      )}

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
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </NeoShell>
  );
}
