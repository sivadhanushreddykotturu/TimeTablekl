import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MdCompareArrows, MdDeleteOutline, MdEdit, MdPersonAdd, MdSync } from "react-icons/md";
import NeoShell, { NeoModal, NeoLoading } from "../Shell.jsx";
import { NeoField, NeoSelect, NeoButton } from "../NeoKit.jsx";
import Toast from "../../components/Toast.jsx";
import { syncTimetable } from "../../../utils/syncTimetable.js";
import { getCurrentAcademicYearOptions, API_CONFIG, getFormData } from "../../config/api.js";
import { trackEvent } from "../../utils/analytics";
import { getSlotTimes, getMaxSlots } from "../../utils/slotTimes";
import { internalsEnabled } from "../../utils/internals.js";

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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editSemester, setEditSemester] = useState("odd");
  const [editAcademicYear, setEditAcademicYear] = useState("");
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

  const openEditModal = (maddy) => {
    const validSemesters = new Set(["odd", "even", "summer", "term3"]);
    const options = getCurrentAcademicYearOptions();
    setEditTarget(maddy);
    setEditName(maddy.name || "");
    setEditUsername(maddy.username || "");
    setEditPassword(maddy.password || "");
    setEditSemester(validSemesters.has(maddy.semester) ? maddy.semester : "odd");
    setEditAcademicYear(maddy.academicYear || options[1] || options[0] || "");
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditTarget(null);
  };

  const handleSaveEdit = () => {
    if (!editTarget) return;

    if (!editName.trim() || editName.trim().length > 10) {
      setToast({
        show: true,
        message: "Please enter a name (max 10 characters).",
        type: "error"
      });
      return;
    }
    if (!editUsername.trim() || !editPassword || !editSemester || !editAcademicYear) {
      setToast({ show: true, message: "Please fill all fields.", type: "error" });
      return;
    }

    const updatedMaddys = maddys.map((maddy) =>
      maddy.id === editTarget.id
        ? {
            ...maddy,
            name: editName.trim(),
            username: editUsername.trim(),
            password: editPassword,
            semester: editSemester,
            academicYear: editAcademicYear
          }
        : maddy
    );
    saveMaddys(updatedMaddys);

    trackEvent('maddy_edited', {
      maddy_id: editTarget.id,
      maddy_name: editName.trim(),
      semester: editSemester,
      academic_year: editAcademicYear
    });

    closeEditModal();
    setToast({ show: true, message: "Friend updated! Resync to refresh timetable.", type: "success" });
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
        <div className="np-pagehead__row">
          <h1 className="np-pagehead__title">Docs</h1>
          {maddys.length > 0 && (
            <div className="np-pagehead__actions">
              <button
                className="np-iconbtn"
                onClick={handleOpenCompare}
                aria-label="Compare timetables"
                title="Compare timetables"
              >
                <MdCompareArrows size={21} />
              </button>
              <button
                className="np-iconbtn"
                onClick={() => setShowAddModal(true)}
                aria-label="Add a friend"
                title="Add a friend"
              >
                <MdPersonAdd size={20} />
              </button>
            </div>
          )}
        </div>
        <p className="np-pagehead__sub">Your friends' timetables, attendance and grades.</p>
      </div>

      {maddys.length === 0 ? (
        <div className="np-empty">
          <h2 className="np-empty__title">No friends added yet</h2>
          <p className="np-empty__text">
            Add a friend with their ERP login to see where they are and how their attendance looks.
          </p>
          <NeoButton type="button" onClick={() => setShowAddModal(true)}>
            Add a friend
          </NeoButton>
        </div>
      ) : (
        maddys.map((maddy) => (
          <article key={maddy.id} className="np-att np-friend">
            <header className="np-att__head">
              <span className="np-friend__avatar" aria-hidden="true">
                {maddy.name.charAt(0).toUpperCase()}
              </span>
              <div className="np-att__title">
                <h2 className="np-att__name">{maddy.name}</h2>
                <div className="np-att__code">
                  {SEMESTER_NAMES[maddy.semester] || maddy.semester} · {maddy.academicYear}
                </div>
              </div>
              <div className="np-friend__tools">
                <button className="np-iconbtn" onClick={() => handleRefreshMaddy(maddy)} aria-label={`Sync ${maddy.name}`} title="Sync">
                  <MdSync size={19} />
                </button>
                <button className="np-iconbtn" onClick={() => openEditModal(maddy)} aria-label={`Edit ${maddy.name}`} title="Edit">
                  <MdEdit size={18} />
                </button>
                <button className="np-iconbtn" onClick={() => openDeleteConfirm(maddy)} aria-label={`Remove ${maddy.name}`} title="Remove">
                  <MdDeleteOutline size={19} />
                </button>
              </div>
            </header>
            <footer className="np-att__tools np-friend__links">
              <button className="np-minibtn" onClick={() => goToMaddy(maddy, "class_info", `/maddys/${maddy.id}/class`)}>
                Right now
              </button>
              <button className="np-minibtn" onClick={() => goToMaddy(maddy, "timetable", `/maddys/${maddy.id}/timetable`)}>
                Timetable
              </button>
              <button className="np-minibtn" onClick={() => goToMaddy(maddy, "attendance", "/attendance", friendState(maddy))}>
                Attendance
              </button>
              <button className="np-minibtn" onClick={() => goToMaddy(maddy, "grades", "/grades", friendState(maddy))}>
                Grades
              </button>
              {internalsEnabled() && (
                <button className="np-minibtn" onClick={() => goToMaddy(maddy, "internals", "/internals", friendState(maddy))}>
                  Internals
                </button>
              )}
              <button className="np-minibtn" onClick={() => goToMaddy(maddy, "exams", "/exam", friendState(maddy))}>
                Exams
              </button>
            </footer>
          </article>
        ))
      )}

      {/* Add friend */}
      <NeoModal
        open={showAddModal}
        title="Add a friend"
        onClose={() => {
          setShowAddModal(false);
          resetAddForm();
        }}
      >
        <NeoField
          id="np-friend-user"
          label="Friend's university ID"
          placeholder="2400090000"
          value={friendUsername}
          onChange={(e) => setFriendUsername(e.target.value)}
        />
        <NeoField
          id="np-friend-pass"
          label="Friend's password"
          type="password"
          placeholder="••••••••"
          value={friendPassword}
          onChange={(e) => setFriendPassword(e.target.value)}
        />
        <div className="np-row">
          <NeoSelect
            id="np-friend-sem"
            label="Semester"
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
            label="Academic year"
            value={friendAcademicYear}
            onChange={(e) => setFriendAcademicYear(e.target.value)}
          >
            {getCurrentAcademicYearOptions().map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </NeoSelect>
        </div>
        <NeoButton type="button" onClick={handleAddFriend} loading={isAddingFriend} loadingText="Adding…">
          Add
        </NeoButton>
      </NeoModal>

      {/* Delete confirmation */}
      <NeoModal open={showDeleteConfirm && !!deleteTarget} title={`Remove ${deleteTarget?.name}?`} onClose={cancelDelete}>
        <p className="np-note" style={{ marginBottom: 16 }}>
          This removes the friend and their saved timetable from this device.
        </p>
        <div className="np-modal__actions">
          <button type="button" onClick={cancelDelete} className="np-btn np-btn--quiet">Cancel</button>
          <button type="button" onClick={confirmDelete} className="np-btn np-btn--pink">Remove</button>
        </div>
      </NeoModal>

      {/* Name friend */}
      <NeoModal open={showNameModal} title="Name this friend">
        <NeoField
          id="np-friend-name"
          label="What do you call them?"
          placeholder="Max 10 characters"
          maxLength={10}
          value={friendName}
          onChange={(e) => setFriendName(e.target.value)}
        />
        <NeoButton type="button" onClick={handleSaveFriend}>
          Save
        </NeoButton>
      </NeoModal>

      {/* Edit friend */}
      <NeoModal
        open={showEditModal && !!editTarget}
        title={`Edit ${editTarget?.name || "friend"}`}
        onClose={closeEditModal}
      >
        <NeoField
          id="np-edit-name"
          label="Name"
          placeholder="Max 10 characters"
          maxLength={10}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
        />
        <NeoField
          id="np-edit-user"
          label="University ID"
          placeholder="2400090000"
          value={editUsername}
          onChange={(e) => setEditUsername(e.target.value)}
        />
        <NeoField
          id="np-edit-pass"
          label="Password"
          type="password"
          placeholder="••••••••"
          value={editPassword}
          onChange={(e) => setEditPassword(e.target.value)}
        />
        <div className="np-row">
          <NeoSelect
            id="np-edit-sem"
            label="Semester"
            value={editSemester}
            onChange={(e) => setEditSemester(e.target.value)}
          >
            <option value="odd">Odd</option>
            <option value="even">Even</option>
            <option value="summer">Summer</option>
            <option value="term3">Term 3</option>
          </NeoSelect>
          <NeoSelect
            id="np-edit-year"
            label="Academic year"
            value={editAcademicYear}
            onChange={(e) => setEditAcademicYear(e.target.value)}
          >
            {Array.from(new Set([editAcademicYear, ...getCurrentAcademicYearOptions()])).filter(Boolean).map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </NeoSelect>
        </div>
        <p className="np-note" style={{ marginBottom: 16 }}>
          Their saved timetable stays as it is until you sync it again.
        </p>
        <NeoButton type="button" onClick={handleSaveEdit}>
          Save changes
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
          These slots changed after the sync:
        </p>
        <div style={{ maxHeight: 280, overflowY: "auto" }}>
          {resyncChanges.map((change, index) => (
            <div key={`${change.day}-${change.slot}-${index}`} className="np-panel" style={{ marginBottom: 10 }}>
              <div className="np-panel__label" style={{ marginBottom: 8 }}>
                {change.day} · Slot {change.slot}
              </div>
              <div className="np-note">
                <div><b style={{ color: "var(--np-pink)" }}>Old</b> — {change.oldClass}</div>
                <div style={{ marginTop: 4 }}><b style={{ color: "var(--np-good)" }}>New</b> — {change.newClass}</div>
              </div>
            </div>
          ))}
        </div>
      </NeoModal>

      {/* Compare */}
      <NeoModal open={showCompareModal} title="Compare timetables" onClose={() => setShowCompareModal(false)} wide>
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
                "You"
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
                selectedMaddyForCompare?.name || "Friend"
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

      {/* Resync options */}
      <NeoModal
        open={showResyncOptions && !!selectedMaddy}
        title={`Sync ${selectedMaddy?.name}`}
        onClose={closeResyncOptions}
      >
        <p className="np-note" style={{ marginBottom: 16 }}>
          Choose semester and academic year before syncing.
        </p>
        <div className="np-row">
          <NeoSelect
            id="np-maddy-resync-sem"
            label="Semester"
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
            label="Academic year"
            value={resyncAcademicYear}
            onChange={(e) => setResyncAcademicYear(e.target.value)}
          >
            {Array.from(new Set([resyncAcademicYear, ...getCurrentAcademicYearOptions()])).map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </NeoSelect>
        </div>
        <NeoButton type="button" onClick={confirmResyncOptions}>
          Sync now
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
