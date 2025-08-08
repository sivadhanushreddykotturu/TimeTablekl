import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header";
import Toast from "../components/Toast";

const slotTimes = {
  1: { start: "07:10", end: "08:00" },
  2: { start: "08:00", end: "08:50" },
  3: { start: "09:20", end: "10:10" },
  4: { start: "10:10", end: "11:00" },
  5: { start: "11:10", end: "12:00" },
  6: { start: "12:00", end: "12:50" },
  7: { start: "13:00", end: "13:50" },
  8: { start: "13:50", end: "14:40" },
  9: { start: "14:50", end: "15:40" },
  10: { start: "15:50", end: "16:40" },
  11: { start: "16:40", end: "17:30" },
};

function getCurrentSlotNumber() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (let slot = 1; slot <= 11; slot++) {
    const [sh, sm] = slotTimes[slot].start.split(":").map(Number);
    const [eh, em] = slotTimes[slot].end.split(":").map(Number);
    const startM = sh * 60 + sm;
    const endM = eh * 60 + em;

    if (currentMinutes >= startM && currentMinutes < endM) return slot;
  }
  return null;
}

function findCurrentAndNextClass(timetable) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = days[new Date().getDay()];
  const slots = timetable?.[today] || {};

  const currentSlot = getCurrentSlotNumber();
  let currentClass = "No ongoing class";
  let nextClass = "No upcoming class";

  const entries = Object.entries(slots)
    .filter(([slot]) => parseInt(slot) <= 11)
    .map(([slot, value]) => [parseInt(slot), value]);

  let currentBlock = null;
  let nextBlock = null;

  const merged = [];
  let i = 0;

  while (i < entries.length) {
    const [startSlot, value] = entries[i];
    if (value === "-") {
      i++;
      continue;
    }

    let endSlot = startSlot;
    while (
      i + 1 < entries.length &&
      entries[i + 1][1] === value &&
      entries[i + 1][0] === endSlot + 1
    ) {
      endSlot++;
      i++;
    }

    merged.push({ content: value, startSlot, endSlot });
    i++;
  }

  if (currentSlot) {
    for (const block of merged) {
      if (currentSlot >= block.startSlot && currentSlot <= block.endSlot) {
        currentBlock = block;
        break;
      }
    }
  }

  if (currentSlot) {
    for (const block of merged) {
      if (block.startSlot > currentSlot) {
        nextBlock = block;
        break;
      }
    }
  } else {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    for (const block of merged) {
      const [sh, sm] = slotTimes[block.startSlot].start.split(":").map(Number);
      const startMinutes = sh * 60 + sm;
      
      if (startMinutes > currentMinutes) {
        nextBlock = block;
        break;
      }
    }
  }

  if (currentBlock) {
    currentClass = `${currentBlock.content} (${slotTimes[currentBlock.startSlot].start} - ${slotTimes[currentBlock.endSlot].end})`;
  }

  if (nextBlock) {
    nextClass = `${nextBlock.content} (${slotTimes[nextBlock.startSlot].start} - ${slotTimes[nextBlock.endSlot].end})`;
  }

  return { currentClass, nextClass };
}

export default function MaddyClassInfo() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [maddy, setMaddy] = useState(null);
  const [current, setCurrent] = useState("Loading...");
  const [next, setNext] = useState("Loading...");
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  useEffect(() => {
    const maddys = JSON.parse(localStorage.getItem("maddys") || "[]");
    const foundMaddy = maddys.find(m => m.id === parseInt(id));
    
    if (!foundMaddy) {
      setToast({
        show: true,
        message: "Friend not found",
        type: "error"
      });
      setTimeout(() => navigate("/maddys"), 2000);
      return;
    }

    setMaddy(foundMaddy);
    const { currentClass, nextClass } = findCurrentAndNextClass(foundMaddy.timetable);
    setCurrent(currentClass);
    setNext(nextClass);
  }, [id, navigate]);

  const closeToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };

  const getSemesterDisplayName = (sem) => {
    switch(sem) {
      case 'odd': return 'Odd Semester';
      case 'even': return 'Even Semester';
      case 'summer': return 'Summer Semester';
      default: return sem;
    }
  };

  if (!maddy) {
    return (
      <>
        <Header onRefresh={() => {}} />
        <div className="container">
          <div className="text-center">
            <h2>Loading...</h2>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header onRefresh={() => {}} />

      <div className="container">
        <div className="page-header">
          <div>
            <h1 className="page-title">{maddy.name}'s Class Info 📚</h1>
            <p className="page-subtitle">
              {getSemesterDisplayName(maddy.semester)} • {maddy.academicYear}
            </p>
          </div>
          <button 
            onClick={() => navigate("/maddys")} 
            className="secondary"
            style={{ marginTop: "16px" }}
          >
            ← Back to Maddys
          </button>
        </div>

        <div className="class-card">
          <h2>Current Class</h2>
          <div className="class-card-content">
            {current}
          </div>
        </div>

        <div className="class-card">
          <h2>Next Class</h2>
          <div className="class-card-content">
            {next}
          </div>
        </div>

        <div className="button-container">
          <button 
            onClick={() => navigate(`/maddys/${id}/timetable`)} 
            className="primary full-width-mobile"
          >
            View Full Timetable 📅
          </button>
        </div>
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={closeToast}
      />
    </>
  );
}
