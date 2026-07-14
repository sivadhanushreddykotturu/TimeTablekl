import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MdCompare } from "react-icons/md";
import {
  FiRefreshCw,
  FiCalendar,
  FiBookOpen,
  FiPieChart,
  FiAward,
  FiTrash2,
} from "react-icons/fi";
import NeoShell, { NeoModal, NeoLoading } from "../Shell.jsx";
import { NeoField, NeoSelect, NeoButton } from "../NeoKit.jsx";
import Toast from "../../components/Toast.jsx";
import { syncTimetable } from "../../../utils/syncTimetable.js";
import { getCurrentAcademicYearOptions, API_CONFIG, getFormData } from "../../config/api.js";
import { trackEvent } from "../../utils/analytics";
import { getSlotTimes, getMaxSlots } from "../../utils/slotTimes";

const SEMESTER_NAMES = {
  odd: "odd sem",
  even: "even sem",
  summer: "summer",
  term3: "term 3",
};

export default function NeoMaddys() {
  const navigate = useNavigate();
  const [maddys, setMaddys] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const [showResyncOptions, setShowResyncOptions] = useState(false);
  const [selectedMaddy, setSelectedMaddy] = useState(null);
  const [resyncSemester, setResyncSemester] = useState("odd");
  const [resyncAcademicYear, setResyncAcademicYear] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  const [friendUsername, setFriendUsername] = useState("");
  const [friendPassword, setFriendPassword] = useState("");
  const [friendSemester, setFriendSemester] = useState("odd");
  const [friendAcademicYear, setFriendAcademicYear] = useState("");
  const [friendName, setFriendName] = useState("");
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempFriendData, setTempFriendData] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [selectedMaddyForCompare, setSelectedMaddyForCompare] = useState(null);
  const [selectedLeftSide, setSelectedLeftSide] = useState("you");
  const [selectedDay, setSelectedDay] = useState(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[new Date().getDay()];
  });
  const [showResyncChangesPopup, setShowResyncChangesPopup] = useState(false);
  const [resyncChanges, setResyncChanges] = useState([]);
  const [resyncTargetName, setResyncTargetName] = useState("");

  useEffect(() => {
    const savedMaddys = JSON.parse(localStorage.getItem("maddys") || "[]");
    setMaddys(savedMaddys);
    trackEvent('maddys_page_viewed', { maddy_count: savedMaddys.length });
  }, []);

  useEffect(() => {
    if (showAddModal) {
      const options = getCurrentAcademicYearOptions();
      setFriendAcademicYear(options[1]);
    }
  }, [showAddModal]);

  const saveMaddys = (newMaddys) => {
    localStorage.setItem("maddys", JSON.stringify(newMaddys));
    setMaddys(newMaddys);
  };

  const handleAddFriend = async () => {
    if (!friendUsername || !friendPassword || !friendSemester || !friendAcademicYear) {
      setToast({ show: true, message: "Please fill all fields.", type: "error" });
      return;
    }

    try {
      setIsAddingFriend(true);
      const form = getFormData(
        friendUsername,
        friendPassword,
        "",
        friendSemester,
        friendAcademicYear,
        "",
        { useStoredCookies: false }
      );

      const response = await fetch(API_CONFIG.FETCH_URL, {
        method: 'POST',
        body: form,
        credentials: 'omit'
      });

      const data = await response.json();

      if (data.success) {
        setTempFriendData({
          username: friendUsername,
          password: friendPassword,
          semester: friendSemester,
          academicYear: friendAcademicYear,
          timetable: data.timetable
        });
        setShowNameModal(true);
        setShowAddModal(false);
        resetAddForm();
      } else {
        setToast({
          show: true,
          message: data.message || "Login failed. Please check credentials.",
          type: "error"
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      setToast({ show: true, message: "Something went wrong.", type: "error" });
    } finally {
      setIsAddingFriend(false);
    }
  };

  const handleSaveFriend = () => {
    if (!friendName.trim() || friendName.length > 10) {
      setToast({
        show: true,
        message: "Please enter a name (max 10 characters).",
        type: "error"
      });
      return;
    }

    const newMaddy = {
      id: Date.now(),
      name: friendName,
      ...tempFriendData
    };

    const updatedMaddys = [...maddys, newMaddy];
    saveMaddys(updatedMaddys);

    trackEvent('maddy_added', {
      maddy_name: friendName,
      semester: tempFriendData.semester,
      academic_year: tempFriendData.academicYear,
      total_maddys: updatedMaddys.length
    });

    setShowNameModal(false);
    setTempFriendData(null);
    setFriendName("");

    setToast({ show: true, message: `${friendName} added successfully!`, type: "success" });
  };

  const resetAddForm = () => {
    setFriendUsername("");
    setFriendPassword("");
    setFriendSemester("odd");
    const options = getCurrentAcademicYearOptions();
    setFriendAcademicYear(options[1]);
  };

  const handleDeleteMaddy = (id) => {
    const updatedMaddys = maddys.filter(maddy => maddy.id !== id);
    saveMaddys(updatedMaddys);
    setToast({ show: true, message: "Friend removed successfully!", type: "success" });
  };

  const openDeleteConfirm = (maddy) => {
    setDeleteTarget(maddy);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    handleDeleteMaddy(deleteTarget.id);
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  const handleRefreshMaddy = (maddy) => {
    const options = getCurrentAcademicYearOptions();
    const defaultYear = options[1] || options[0];
    setSelectedMaddy(maddy);
    const validSemesters = new Set(["odd", "even", "summer", "term3"]);
    setResyncSemester(validSemesters.has(maddy.semester) ? maddy.semester : "odd");
    setResyncAcademicYear(maddy.academicYear || defaultYear || "");
    setShowResyncOptions(true);
  };

  const confirmResyncOptions = async () => {
    if (!selectedMaddy) return;

    const updatedMaddys = maddys.map((maddy) =>
      maddy.id === selectedMaddy.id
        ? { ...maddy, semester: resyncSemester, academicYear: resyncAcademicYear }
        : maddy
    );

    saveMaddys(updatedMaddys);

    const updatedSelected = updatedMaddys.find(m => m.id === selectedMaddy.id) || null;
    setSelectedMaddy(updatedSelected);
    setShowResyncOptions(false);

    setLoading(true);
    setLoadingMessage("syncing friend's timetable…");
    try {
      const newTimetable = await syncTimetable({
        username: updatedSelected.username,
        password: updatedSelected.password,
        semester: resyncSemester,
        academicYear: resyncAcademicYear,
        name: updatedSelected.name
      });
      handleSyncSuccess(updatedSelected, updatedMaddys, newTimetable);
    } catch (err) {
      setToast({
        show: true,
        message: err.message || "Failed to resync friend.",
        type: "error"
      });
      setSelectedMaddy(null);
    } finally {
      setLoading(false);
    }
  };

  const closeResyncOptions = () => {
    setShowResyncOptions(false);
    setSelectedMaddy(null);
  };

  const getTimetableChanges = (oldTimetable = {}, newTimetable = {}) => {
    const changes = [];
    const allDays = Array.from(new Set([
      ...Object.keys(oldTimetable || {}),
      ...Object.keys(newTimetable || {})
    ]));

    allDays.forEach((day) => {
      const oldSlots = oldTimetable?.[day] || {};
      const newSlots = newTimetable?.[day] || {};
      const allSlots = Array.from(new Set([
        ...Object.keys(oldSlots),
        ...Object.keys(newSlots)
      ])).sort((a, b) => Number(a) - Number(b));

      allSlots.forEach((slot) => {
        const oldClass = oldSlots[slot] || "-";
        const newClass = newSlots[slot] || "-";
        if (oldClass !== newClass) {
          changes.push({ day, slot, oldClass, newClass });
        }
      });
    });

    return changes;
  };

  const handleSyncSuccess = (targetMaddy, currentMaddys, newTimetable) => {
    if (targetMaddy) {
      const oldTimetableSnapshot = targetMaddy.timetable || {};
      const changes = getTimetableChanges(oldTimetableSnapshot, newTimetable);
      const updatedMaddys = currentMaddys.map(maddy =>
        maddy.id === targetMaddy.id
          ? { ...maddy, timetable: newTimetable }
          : maddy
      );
      saveMaddys(updatedMaddys);
      if (changes.length > 0) {
        setResyncChanges(changes);
        setResyncTargetName(targetMaddy.name || "Friend");
        setShowResyncChangesPopup(true);
      } else {
        setResyncChanges([]);
        setShowResyncChangesPopup(false);
      }
    }
    setSelectedMaddy(null);
  };

  const closeToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };

  // "24GMI3101HF-P - S-2 -RoomNo-C018" -> "24GMI3101HF-P - C018"
  const formatClassNameForCompare = (content) => {
    if (!content || content === "-") return content;

    const parts = content.split(" - ");
    if (parts.length === 0) return content;

    const courseCode = parts[0];

    const roomMatch = content.match(/RoomNo-([A-Z0-9]+)|-([A-Z]\d+)(?:\s|$)/);
    const roomNumber = roomMatch ? (roomMatch[1] || roomMatch[2]) : null;

    if (roomNumber) {
      return `${courseCode} - ${roomNumber}`;
    }

    return courseCode;
  };

  const renderCompareDay = (slots, username = null) => {
    if (!slots || Object.keys(slots).length === 0) {
      return <p className="np-note np-dim" style={{ padding: 16, textAlign: "center" }}>No classes</p>;
    }

    const slotTimes = getSlotTimes(username);
    const maxSlots = getMaxSlots(username);

    const entries = Object.entries(slots)
      .filter(([slot]) => parseInt(slot) <= maxSlots)
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

    if (merged.length === 0) {
      return <p className="np-note np-dim" style={{ padding: 16, textAlign: "center" }}>No classes</p>;
    }

    return (
      <div className="np-compare__body">
        {merged.map((block, idx) => (
          <div key={idx} className="np-compare__block">
            <div className="np-compare__time">
              {slotTimes[block.startSlot].start} – {slotTimes[block.endSlot].end}
            </div>
            <div className="np-compare__name">{formatClassNameForCompare(block.content)}</div>
          </div>
        ))}
      </div>
    );
  };

  const handleOpenCompare = () => {
    if (maddys.length === 0) {
      setToast({ show: true, message: "No friends to compare with", type: "error" });
      return;
    }
    setSelectedMaddyForCompare(maddys[0]);
    setSelectedLeftSide("you");
    setShowCompareModal(true);
  };

  const goToMaddy = (maddy, viewType, path, state) => {
    trackEvent('maddy_viewed', {
      maddy_id: maddy.id,
      maddy_name: maddy.name,
      view_type: viewType
    });
    navigate(path, state ? { state } : undefined);
  };

  const friendState = (maddy) => ({
    friendCredentials: {
      username: maddy.username,
      password: maddy.password,
      semester: maddy.semester,
      academicYear: maddy.academicYear,
      name: maddy.name
    }
  });

  return (
    <NeoShell>
      <div className="np-pagehead">
        <span className="np-eyebrow">friends' timetables</span>
        <h1 className="np-pagehead__title">where's doc<i>?</i></h1>
      </div>

      {maddys.length === 0 ? (
        <div className="np-empty">
          <h2 className="np-empty__title">no docs added yet</h2>
          <p className="np-empty__text">Add a friend to track their timetable, attendance and grades.</p>
          <NeoButton type="button" onClick={() => setShowAddModal(true)}>
            add doc
          </NeoButton>
        </div>
      ) : (
        <>
          {maddys.map((maddy) => (
            <div key={maddy.id} className="np-maddy">
              <div className="np-maddy__top">
                <h3 className="np-maddy__name">{maddy.name}</h3>
                <button
                  className="np-action np-action--danger"
                  onClick={() => openDeleteConfirm(maddy)}
                  title="Remove"
                >
                  <FiTrash2 size={15} />
                </button>
              </div>
              <p className="np-maddy__meta">
                {SEMESTER_NAMES[maddy.semester] || maddy.semester} · {maddy.academicYear}
              </p>
              <div className="np-maddy__actions">
                <button className="np-action" onClick={() => handleRefreshMaddy(maddy)} title="Resync">
                  <FiRefreshCw size={15} />
                </button>
                <button
                  className="np-action"
                  onClick={() => goToMaddy(maddy, 'timetable', `/maddys/${maddy.id}/timetable`)}
                  title="Timetable"
                >
                  <FiCalendar size={15} />
                </button>
                <button
                  className="np-action"
                  onClick={() => goToMaddy(maddy, 'class_info', `/maddys/${maddy.id}/class`)}
                  title="Class info"
                >
                  <FiBookOpen size={15} />
                </button>
                <button
                  className="np-action"
                  onClick={() => goToMaddy(maddy, 'attendance', "/attendance", friendState(maddy))}
                  title="Attendance"
                >
                  <FiPieChart size={15} />
                </button>
                <button
                  className="np-action"
                  onClick={() => goToMaddy(maddy, 'grades', "/grades", friendState(maddy))}
                  title="Grades"
                >
                  <FiAward size={15} />
                </button>
              </div>
            </div>
          ))}

          <NeoButton type="button" onClick={() => setShowAddModal(true)}>
            add another doc
          </NeoButton>
        </>
      )}

      {/* Add friend */}
      <NeoModal
        open={showAddModal}
        title="add doc"
        onClose={() => {
          setShowAddModal(false);
          resetAddForm();
        }}
      >
        <NeoField
          id="np-friend-user"
          label="friend's university id"
          placeholder="2400090000"
          value={friendUsername}
          onChange={(e) => setFriendUsername(e.target.value)}
        />
        <NeoField
          id="np-friend-pass"
          label="friend's password"
          type="password"
          placeholder="••••••••"
          value={friendPassword}
          onChange={(e) => setFriendPassword(e.target.value)}
        />
        <div className="np-row">
          <NeoSelect
            id="np-friend-sem"
            label="semester"
            value={friendSemester}
            onChange={(e) => setFriendSemester(e.target.value)}
          >
            <option value="odd">Odd</option>
            <option value="even">Even</option>
            <option value="summer">Summer</option>
            <option value="term3">Term 3</option>
          </NeoSelect>
          <NeoSelect
            id="np-friend-year"
            label="academic year"
            value={friendAcademicYear}
            onChange={(e) => setFriendAcademicYear(e.target.value)}
          >
            {getCurrentAcademicYearOptions().map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </NeoSelect>
        </div>
        <NeoButton type="button" onClick={handleAddFriend} loading={isAddingFriend} loadingText="adding…">
          add friend
        </NeoButton>
      </NeoModal>

      {/* Delete confirmation */}
      <NeoModal open={showDeleteConfirm && !!deleteTarget} title={`remove ${deleteTarget?.name}?`} onClose={cancelDelete}>
        <p className="np-note" style={{ marginBottom: 16 }}>
          This removes the friend and their saved timetable from this device.
        </p>
        <div className="np-modal__actions">
          <button onClick={cancelDelete} className="secondary">Cancel</button>
          <button onClick={confirmDelete} className="danger">Delete</button>
        </div>
      </NeoModal>

      {/* Name friend */}
      <NeoModal open={showNameModal} title="name your doc">
        <NeoField
          id="np-friend-name"
          label="what do you call them?"
          placeholder="max 10 characters"
          maxLength={10}
          value={friendName}
          onChange={(e) => setFriendName(e.target.value)}
        />
        <NeoButton type="button" onClick={handleSaveFriend}>
          save
        </NeoButton>
      </NeoModal>

      {/* Loading overlay */}
      {loading && (
        <div className="np-modal-overlay" style={{ zIndex: 9999 }}>
          <NeoLoading text={loadingMessage} />
        </div>
      )}

      {/* Resync changes */}
      <NeoModal
        open={showResyncChangesPopup}
        title={`${resyncTargetName}'s timetable changes`}
        onClose={() => {
          setShowResyncChangesPopup(false);
          setResyncChanges([]);
          setResyncTargetName("");
        }}
      >
        <p className="np-note" style={{ marginBottom: 14 }}>
          These slots changed after the resync:
        </p>
        <div style={{ maxHeight: 280, overflowY: "auto" }}>
          {resyncChanges.map((change, index) => (
            <div key={`${change.day}-${change.slot}-${index}`} className="np-panel" style={{ marginBottom: 10 }}>
              <div className="np-panel__label" style={{ marginBottom: 8 }}>
                {change.day} · slot {change.slot}
              </div>
              <div className="np-note">
                <div><b style={{ color: "var(--np-pink)" }}>old</b> — {change.oldClass}</div>
                <div style={{ marginTop: 4 }}><b style={{ color: "var(--np-acid)" }}>new</b> — {change.newClass}</div>
              </div>
            </div>
          ))}
        </div>
      </NeoModal>

      {/* Compare */}
      <NeoModal open={showCompareModal} title="compare timetables" onClose={() => setShowCompareModal(false)} wide>
        <div className="np-field" style={{ marginBottom: 14 }}>
          <select
            className="np-field__input"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </div>

        <div className="np-compare">
          <div className="np-compare__panel">
            <div className="np-compare__label">
              {maddys.length > 1 ? (
                <select
                  className="np-field__input"
                  value={selectedLeftSide}
                  onChange={(e) => setSelectedLeftSide(e.target.value)}
                >
                  <option value="you">You</option>
                  {maddys.map((maddy) => (
                    <option key={maddy.id} value={maddy.id} disabled={selectedMaddyForCompare?.id === maddy.id}>
                      {maddy.name}
                    </option>
                  ))}
                </select>
              ) : (
                "you"
              )}
            </div>
            {selectedLeftSide === "you" ? (
              (() => {
                const mainTimetable = JSON.parse(localStorage.getItem("timetable") || "{}");
                return renderCompareDay(mainTimetable[selectedDay], null);
              })()
            ) : (
              (() => {
                const leftMaddy = maddys.find(m => m.id === parseInt(selectedLeftSide));
                return leftMaddy && leftMaddy.timetable ? (
                  renderCompareDay(leftMaddy.timetable[selectedDay], leftMaddy.username)
                ) : (
                  <p className="np-note np-dim" style={{ padding: 16, textAlign: "center" }}>No timetable</p>
                );
              })()
            )}
          </div>

          <div className="np-compare__panel">
            <div className="np-compare__label">
              {maddys.length > 1 ? (
                <select
                  className="np-field__input"
                  value={selectedMaddyForCompare?.id || ""}
                  onChange={(e) => {
                    const maddy = maddys.find(m => m.id === parseInt(e.target.value));
                    setSelectedMaddyForCompare(maddy);
                  }}
                >
                  {maddys.map((maddy) => (
                    <option
                      key={maddy.id}
                      value={maddy.id}
                      disabled={selectedLeftSide === maddy.id.toString()}
                    >
                      {maddy.name}
                    </option>
                  ))}
                </select>
              ) : (
                selectedMaddyForCompare?.name || "friend"
              )}
            </div>
            {selectedMaddyForCompare && selectedMaddyForCompare.timetable ? (
              renderCompareDay(selectedMaddyForCompare.timetable[selectedDay], selectedMaddyForCompare.username)
            ) : (
              <p className="np-note np-dim" style={{ padding: 16, textAlign: "center" }}>Select a friend</p>
            )}
          </div>
        </div>
      </NeoModal>

      {maddys.length > 0 && (
        <button
          className="np-fab np-fab--1"
          onClick={handleOpenCompare}
          title="Compare timetables"
        >
          <MdCompare size={20} />
        </button>
      )}

      {/* Resync options */}
      <NeoModal
        open={showResyncOptions && !!selectedMaddy}
        title={`resync ${selectedMaddy?.name}`}
        onClose={closeResyncOptions}
      >
        <p className="np-note" style={{ marginBottom: 16 }}>
          Choose semester and academic year before syncing.
        </p>
        <div className="np-row">
          <NeoSelect
            id="np-maddy-resync-sem"
            label="semester"
            value={resyncSemester}
            onChange={(e) => setResyncSemester(e.target.value)}
          >
            <option value="odd">Odd</option>
            <option value="even">Even</option>
            <option value="summer">Summer</option>
            <option value="term3">Term 3</option>
          </NeoSelect>
          <NeoSelect
            id="np-maddy-resync-year"
            label="academic year"
            value={resyncAcademicYear}
            onChange={(e) => setResyncAcademicYear(e.target.value)}
          >
            {Array.from(new Set([resyncAcademicYear, ...getCurrentAcademicYearOptions()])).map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </NeoSelect>
        </div>
        <NeoButton type="button" onClick={confirmResyncOptions}>
          sync now
        </NeoButton>
      </NeoModal>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={closeToast}
      />
    </NeoShell>
  );
}
