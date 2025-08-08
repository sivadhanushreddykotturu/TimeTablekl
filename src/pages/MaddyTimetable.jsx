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

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MaddyTimetable() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [maddy, setMaddy] = useState(null);
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

  const renderTimetableDay = (day, slots) => {
    const entries = Object.entries(slots)
      .filter(([slot]) => parseInt(slot) <= 11)
      .map(([slot, value]) => [parseInt(slot), value]);

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

    return (
      <div key={day} className="timetable-day">
        <h3>{day}</h3>
        <div className="timetable-slots">
          {merged.map((block, index) => (
            <div key={index} className="class-block">
              <div className="class-name">{block.content}</div>
              <div className="class-time">
                {slotTimes[block.startSlot].start} - {slotTimes[block.endSlot].end}
              </div>
            </div>
          ))}
          {merged.length === 0 && (
            <div className="no-classes">No classes today</div>
          )}
        </div>
      </div>
    );
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
            <h1 className="page-title">{maddy.name}'s Timetable 📅</h1>
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

        <div className="timetable-container">
          {Object.entries(maddy.timetable).map(([day, slots]) =>
            renderTimetableDay(day, slots)
          )}
        </div>

        <div className="button-container">
          <button 
            onClick={() => navigate(`/maddys/${id}/class`)} 
            className="secondary full-width-mobile"
          >
            View Class Info 📚
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
