import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiCalendar } from "react-icons/fi";
import NeoShell from "../Shell.jsx";
import Toast from "../../components/Toast.jsx";
import { getSlotTimes, getMaxSlots } from "../../utils/slotTimes";

const SEMESTER_NAMES = {
  odd: "odd sem",
  even: "even sem",
  summer: "summer",
  term3: "term 3",
};

function getCurrentSlotNumber(username) {
  const slotTimes = getSlotTimes(username);
  const maxSlots = getMaxSlots(username);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (let slot = 1; slot <= maxSlots; slot++) {
    const [sh, sm] = slotTimes[slot].start.split(":").map(Number);
    const [eh, em] = slotTimes[slot].end.split(":").map(Number);
    const startM = sh * 60 + sm;
    const endM = eh * 60 + em;

    if (currentMinutes >= startM && currentMinutes < endM) return slot;
  }
  return null;
}

function findCurrentAndNextClass(timetable, username) {
  const slotTimes = getSlotTimes(username);
  const maxSlots = getMaxSlots(username);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = days[new Date().getDay()];
  const slots = timetable?.[today] || {};

  const currentSlot = getCurrentSlotNumber(username);

  const entries = Object.entries(slots)
    .filter(([slot]) => parseInt(slot) <= maxSlots)
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

  const toInfo = (block) =>
    block
      ? {
          name: block.content,
          time: `${slotTimes[block.startSlot].start} – ${slotTimes[block.endSlot].end}`,
        }
      : null;

  return { current: toInfo(currentBlock), next: toInfo(nextBlock) };
}

export default function NeoMaddyClassInfo() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [maddy, setMaddy] = useState(null);
  const [current, setCurrent] = useState(null);
  const [next, setNext] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  useEffect(() => {
    const maddys = JSON.parse(localStorage.getItem("maddys") || "[]");
    const foundMaddy = maddys.find(m => m.id === parseInt(id));

    if (!foundMaddy) {
      setToast({ show: true, message: "Friend not found", type: "error" });
      setTimeout(() => navigate("/maddys"), 2000);
      return;
    }

    setMaddy(foundMaddy);
    const { current: cur, next: nxt } = findCurrentAndNextClass(foundMaddy.timetable, foundMaddy.username);
    setCurrent(cur);
    setNext(nxt);
  }, [id, navigate]);

  if (!maddy) {
    return (
      <NeoShell>
        <div className="np-loading">
          <div className="np-loading__blocks" aria-hidden="true"><span /><span /><span /><span /></div>
          <div className="np-loading__text">loading…</div>
        </div>
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.show}
          onClose={() => setToast(prev => ({ ...prev, show: false }))}
        />
      </NeoShell>
    );
  }

  return (
    <NeoShell>
      <div className="np-pagehead">
        <button className="np-iconbtn" style={{ marginBottom: 14 }} onClick={() => navigate("/maddys")}>
          <FiArrowLeft size={13} /> back to docs
        </button>
        <span className="np-eyebrow">
          {SEMESTER_NAMES[maddy.semester] || maddy.semester} · {maddy.academicYear}
        </span>
        <h1 className="np-pagehead__title">{maddy.name} rn<i>.</i></h1>
      </div>

      <section className={`np-now${current ? "" : " np-now--idle"}`}>
        <div className="np-now__label">
          <span className="np-now__pulse" />
          {current ? "happening now" : "nothing right now"}
        </div>
        <div className="np-now__class">
          {current ? current.name : `${maddy.name} has no ongoing class.`}
        </div>
        {current && <div className="np-now__time">{current.time}</div>}
      </section>

      <section className="np-next">
        <span className="np-next__label">up<br />next</span>
        <div className="np-next__body">
          <div className="np-next__class">
            {next ? next.name : "No more classes today"}
          </div>
          {next && <div className="np-next__time">{next.time}</div>}
        </div>
      </section>

      <button
        className="np-linkrow"
        onClick={() => navigate(`/maddys/${id}/timetable`)}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <FiCalendar size={15} /> view full timetable
        </span>
        <span className="np-linkrow__go">→</span>
      </button>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </NeoShell>
  );
}
