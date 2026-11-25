import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { MdSchedule, MdRocketLaunch } from "react-icons/md";
import NeoShell, { NeoSkeleton } from "../Shell.jsx";
import { SettingsGroup, SettingsRow, Switch } from "../components/Settings.jsx";
import EditSlotModal from "../../components/EditSlotModal";
import Toast from "../../components/Toast.jsx";
import GuestAuthModal from "../../components/GuestAuthModal.jsx";
import { getCredentials } from "../../../utils/storage.js";
import { syncSeatingPlan } from "../../../utils/syncSeatingPlan.js";
import { getSubjectName } from "../../utils/subjectMapper";
import { getSlotDetails } from "../../utils/examSlots";
import { useNowTick } from "../../hooks/useNowTick";

const SLOT_ORDER = { MN: 1, MO: 1, AM: 2, FN: 3, PM: 4, EN: 5, AN: 6 };
const END_OF_DAY = 23 * 60 + 59;

function readSeatingPlan() {
  try {
    return JSON.parse(localStorage.getItem("seatingPlan") || "[]") || [];
  } catch {
    return [];
  }
}

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

/** Exams in order, each with display strings and whether it is over. */
function buildSchedule(seatingPlan, slotDetails) {
  const now = new Date();
  const today = startOfDay(now).getTime();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return seatingPlan
    .map((exam) => {
      const slot = (exam.time_slot || "").toUpperCase();
      const isEndSem = (exam.exam_type || "").toLowerCase().includes("end");
      const info = isEndSem ? null : slotDetails.inSemester[slot];
      const date = startOfDay(exam.date);
      const dayTime = date.getTime();

      return {
        key: `${exam.course_code}-${exam.date}-${slot}`,
        name: getSubjectName(exam.course_code),
        room: exam.room_no,
        type: exam.exam_type || "",
        slot,
        time: info?.label || "",
        date,
        isToday: dayTime === today,
        isOver: dayTime < today || (dayTime === today && nowMinutes >= (info?.endMinutes ?? END_OF_DAY)),
        order: dayTime * 10 + (SLOT_ORDER[slot] || 0),
      };
    })
    .sort((a, b) => a.order - b.order);
}

const describe = (exam) => [exam.room && `Room ${exam.room}`, exam.time || exam.slot].filter(Boolean).join(" · ");

export default function NeoExam() {
  const location = useLocation();
  // a friend's exams are view-only: their plan is fetched fresh, never saved, and there are no launch settings
  const friend = location.state?.friendCredentials || null;
  const [friendLoading, setFriendLoading] = useState(Boolean(friend));
  const [friendError, setFriendError] = useState("");
  const [seatingPlan, setSeatingPlan] = useState(() => (friend ? [] : readSeatingPlan()));
  const [slotDetails, setSlotDetails] = useState(getSlotDetails);
  const [launchHere, setLaunchHere] = useState(() => localStorage.getItem("examMode") === "true");
  const [showEditSlots, setShowEditSlots] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(() => !friend && !getCredentials());
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const nowTick = useNowTick();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const schedule = useMemo(() => buildSchedule(seatingPlan, slotDetails), [seatingPlan, slotDetails, nowTick]);
  const upcoming = useMemo(() => schedule.filter((exam) => !exam.isOver), [schedule]);
  const next = upcoming[0] || null;
  const signedIn = Boolean(friend) || Boolean(getCredentials());

  const loadFriendPlan = async () => {
    setFriendLoading(true);
    setFriendError("");
    try {
      setSeatingPlan(await syncSeatingPlan(friend));
    } catch (error) {
      setFriendError(error.message);
      throw error;
    } finally {
      setFriendLoading(false);
    }
  };

  useEffect(() => {
    if (friend) loadFriendPlan().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend?.username]);

  const handleSync = async () => {
    if (friend) {
      await loadFriendPlan();
      return;
    }
    if (!getCredentials()) {
      setShowGuestModal(true);
      return;
    }
    try {
      const plan = await syncSeatingPlan();
      setSeatingPlan(plan);
      setToast({
        show: true,
        message: plan.length ? "Seating plan updated." : "No exams scheduled yet.",
        type: "success",
      });
    } catch (error) {
      setToast({ show: true, message: error.message, type: "error" });
      throw error;
    }
  };

  const toggleLaunchHere = () =>
    setLaunchHere((prev) => {
      const value = !prev;
      if (value) localStorage.setItem("examMode", "true");
      else localStorage.removeItem("examMode");
      return value;
    });

  const launchRow = (
    <SettingsRow
      icon={<MdRocketLaunch size={22} />}
      title="Open on Exams"
      description="Launch the app here during exam weeks"
      role="switch"
      aria-checked={launchHere}
      trailing={<Switch on={launchHere} />}
      onClick={toggleLaunchHere}
    />
  );

  return (
    <NeoShell onRefresh={handleSync} refreshLabel="Sync">
      <div className="np-pagehead">
        <h1 className="np-pagehead__title">{friend ? `${friend.name}'s exams` : "Exams"}</h1>
      </div>

      {friend && friendLoading ? (
        <NeoSkeleton variant="list" count={4} text={`Fetching ${friend.name}'s exams…`} />
      ) : friend && friendError ? (
        <div className="np-empty">
          <h2 className="np-empty__title">Couldn't load exams</h2>
          <p className="np-empty__text">{friendError}</p>
          <button type="button" className="np-btn" onClick={() => loadFriendPlan().catch(() => {})}>Try again</button>
        </div>
      ) : !signedIn ? (
        <div className="np-empty">
          <h2 className="np-empty__title">See your exam seating</h2>
          <p className="np-empty__text">Log in with your KL ERP account to load your exam dates and rooms.</p>
          <button type="button" className="np-btn" onClick={() => setShowGuestModal(true)}>Log in</button>
        </div>
      ) : schedule.length === 0 ? (
        <div className="np-empty">
          <h2 className="np-empty__title">No exams yet</h2>
          <p className="np-empty__text">Once ERP publishes the seating plan, sync to pull it in.</p>
        </div>
      ) : (
        <>
          {next && (
            <section className="np-now">
              <div className="np-now__label">
                <span className="np-now__pulse" />
                <span>
                  {next.isToday
                    ? "Today"
                    : next.date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                </span>
              </div>
              <div className="np-now__class">{next.name}</div>
              <div className="np-now__time">{describe(next)}</div>
            </section>
          )}

          {signedIn && !friend && (
            <div style={{ marginTop: next ? 14 : 0 }}>
              <SettingsGroup>{launchRow}</SettingsGroup>
            </div>
          )}

          <section className="np-shelf" style={{ marginTop: 22 }}>
            <div className="np-shelf__head">
              <h2 className="np-shelf__title">Schedule</h2>
              <span className="np-shelf__meta">
                {upcoming.length} {upcoming.length === 1 ? "exam" : "exams"} left
              </span>
            </div>
            <div className="np-timeline">
              {upcoming.map((exam) => (
                <div key={exam.key} className={`np-slot${exam.isOver ? " is-done" : ""}`}>
                  <div className="np-slot__time np-slot__time--date">
                    <b>{exam.date.getDate()}</b>
                    <small>{exam.date.toLocaleDateString("en-US", { month: "short" })}</small>
                  </div>
                  <div className="np-slot__body">
                    <div className="np-slot__name">{exam.name}</div>
                    <div className="np-slot__meta">{describe(exam)}</div>
                    {exam.type && <div className="np-slot__meta">{exam.type}</div>}
                  </div>
                  {exam === next && <span className="np-slot__live">Next</span>}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {signedIn && !friend && (
        <div style={{ marginTop: 26 }}>
          <SettingsGroup>
            <SettingsRow
              icon={<MdSchedule size={22} />}
              title="Slot timings"
              description="When each exam slot starts and ends"
              onClick={() => setShowEditSlots(true)}
            />
            {schedule.length === 0 && launchRow}
          </SettingsGroup>
        </div>
      )}

      <EditSlotModal
        isOpen={showEditSlots}
        onClose={() => setShowEditSlots(false)}
        onSave={(details) => {
          setSlotDetails(details);
          setToast({ show: true, message: "Slot timings saved.", type: "success" });
        }}
      />

      <GuestAuthModal
        isOpen={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        pageType="exam"
        onSuccess={async () => {
          setShowGuestModal(false);
          handleSync().catch(() => {});
        }}
      />

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
    </NeoShell>
  );
}
