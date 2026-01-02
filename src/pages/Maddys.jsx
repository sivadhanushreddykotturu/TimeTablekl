import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import CaptchaModal from "../components/CaptchaModal";
import Toast from "../components/Toast";
import { getTodaySubjects } from "../utils/subjectMapper";
import { getCurrentAcademicYearOptions, API_CONFIG, getFormData } from "../config/api.js";
import { trackEvent } from "../utils/analytics";

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

export default function Maddys() {
  const navigate = useNavigate();
  const [maddys, setMaddys] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [showResyncOptions, setShowResyncOptions] = useState(false);
  const [selectedMaddy, setSelectedMaddy] = useState(null);
  const [resyncSemester, setResyncSemester] = useState("odd");
  const [resyncAcademicYear, setResyncAcademicYear] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  
  // Add friend states
  const [friendUsername, setFriendUsername] = useState("");
  const [friendPassword, setFriendPassword] = useState("");
  const [friendCaptcha, setFriendCaptcha] = useState("");
  const [friendCaptchaUrl, setFriendCaptchaUrl] = useState("");
  const [friendSessionId, setFriendSessionId] = useState("");
  const [friendCaptchaLoading, setFriendCaptchaLoading] = useState(true);
  const [friendSemester, setFriendSemester] = useState("odd");
  const [friendAcademicYear, setFriendAcademicYear] = useState("");
  const [friendName, setFriendName] = useState("");
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempFriendData, setTempFriendData] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isAddingFriend, setIsAddingFriend] = useState(false);

  useEffect(() => {
    const savedMaddys = JSON.parse(localStorage.getItem("maddys") || "[]");
    setMaddys(savedMaddys);
    
    // Track maddys page view
    trackEvent('maddys_page_viewed', {
      maddy_count: savedMaddys.length
    });
  }, []);

  useEffect(() => {
    if (showAddModal) {
      refreshFriendCaptcha();
      const options = getCurrentAcademicYearOptions();
      setFriendAcademicYear(options[1]); // Use current year as default
    }
  }, [showAddModal]);

  const saveMaddys = (newMaddys) => {
    localStorage.setItem("maddys", JSON.stringify(newMaddys));
    setMaddys(newMaddys);
  };

  const refreshFriendCaptcha = async () => {
    setFriendCaptchaLoading(true);
    setFriendCaptcha("");
    setFriendSessionId(""); // Reset session ID
    
    try {
      const response = await fetch(API_CONFIG.CAPTCHA_URL);
      
      console.log("Response headers:", response.headers);
      
      // Get session ID from response headers (try different cases)
      const sessionIdFromHeader = response.headers.get('x-session-id') || 
                                 response.headers.get('X-Session-ID') || 
                                 response.headers.get('X-SESSION-ID');
      
      console.log("Session ID from header:", sessionIdFromHeader);
      
      if (sessionIdFromHeader) {
        setFriendSessionId(sessionIdFromHeader);
        console.log("Session ID set:", sessionIdFromHeader);
      } else {
        console.log("No session ID found in headers, using fallback");
        // Fallback: use timestamp as session ID for new backend compatibility
        const fallbackSessionId = `session_${Date.now()}`;
        setFriendSessionId(fallbackSessionId);
        console.log("Using fallback session ID:", fallbackSessionId);
      }
      
      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      setFriendCaptchaUrl(imageUrl);
      console.log("Image URL created:", imageUrl);
      
    } catch (error) {
      console.error("Error loading CAPTCHA:", error);
      setToast({
        show: true,
        message: "Failed to load CAPTCHA",
        type: "error"
      });
    } finally {
      setFriendCaptchaLoading(false);
    }
  };

  const handleAddFriend = async () => {
    console.log("Add friend attempt - sessionId:", friendSessionId);
    console.log("All fields:", { friendUsername, friendPassword, friendCaptcha, friendSemester, friendAcademicYear, friendSessionId });
    
    if (!friendUsername || !friendPassword || !friendCaptcha || !friendSemester || !friendAcademicYear) {
      setToast({
        show: true,
        message: "Please fill all fields.",
        type: "error"
      });
      return;
    }

    try {
      setIsAddingFriend(true);
      const form = getFormData(friendUsername, friendPassword, friendCaptcha, friendSemester, friendAcademicYear, friendSessionId);

      const response = await fetch(API_CONFIG.FETCH_URL, {
        method: 'POST',
        body: form
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
          message: data.message || "Login failed.",
          type: "error"
        });
        refreshFriendCaptcha();
      }
    } catch (error) {
      console.error("Login error:", error);
      setToast({
        show: true,
        message: "Something went wrong.",
        type: "error"
      });
      refreshFriendCaptcha();
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
    
    // Track maddy added
    trackEvent('maddy_added', {
      maddy_name: friendName,
      semester: tempFriendData.semester,
      academic_year: tempFriendData.academicYear,
      total_maddys: updatedMaddys.length
    });
    
    setShowNameModal(false);
    setTempFriendData(null);
    setFriendName("");
    
    setToast({
      show: true,
      message: `${friendName} added successfully!`,
      type: "success"
    });
  };

  const resetAddForm = () => {
    setFriendUsername("");
    setFriendPassword("");
    setFriendCaptcha("");
    setFriendCaptchaUrl("");
    setFriendSessionId("");
    setFriendCaptchaLoading(true);
    setFriendSemester("odd");
    const options = getCurrentAcademicYearOptions();
    setFriendAcademicYear(options[1]); // Use current year as default
  };

  const handleDeleteMaddy = (id) => {
    const updatedMaddys = maddys.filter(maddy => maddy.id !== id);
    saveMaddys(updatedMaddys);
    setToast({
      show: true,
      message: "Friend removed successfully!",
      type: "success"
    });
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
    setResyncSemester(maddy.semester || "odd");
    setResyncAcademicYear(maddy.academicYear || defaultYear || "");
    setShowResyncOptions(true);
  };

  const confirmResyncOptions = () => {
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
    setShowCaptchaModal(true);
  };

  const closeResyncOptions = () => {
    setShowResyncOptions(false);
    setSelectedMaddy(null);
  };

  const handleCaptchaSuccess = (newTimetable) => {
    if (selectedMaddy) {
      const updatedMaddys = maddys.map(maddy => 
        maddy.id === selectedMaddy.id 
          ? { ...maddy, timetable: newTimetable }
          : maddy
      );
      saveMaddys(updatedMaddys);
      setToast({
        show: true,
        message: `${selectedMaddy.name}'s timetable synced successfully!`,
        type: "success"
      });
    }
    setSelectedMaddy(null);
  };

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

  return (
    <>
      <Header onRefresh={() => {}} />

      <div className="container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Where's Maddy? 👥</h1>
            <p className="page-subtitle">Track your friends' timetables</p>
          </div>
          <button 
            onClick={() => navigate("/home")} 
            className="secondary"
            style={{ marginTop: "16px" }}
          >
            ← Back to Home
          </button>
        </div>

        {maddys.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-content">
              <h2>No friends added yet</h2>
              <p>Add your friends to track their timetables</p>
              <button 
                onClick={() => setShowAddModal(true)} 
                className="primary"
              >
                Add Your Maddy 👤
              </button>
            </div>
          </div>
        ) : (
          <div className="maddys-list">
            {maddys.map((maddy) => (
              <div key={maddy.id} className="maddy-card">
                <div className="maddy-header">
                  <h3>{maddy.name}</h3>
                  <div className="maddy-actions">
                    <button 
                      onClick={() => handleRefreshMaddy(maddy)}
                      className="action-btn"
                      title="Refresh"
                    >
                      🔄
                    </button>
                    <button 
                      onClick={() => {
                        trackEvent('maddy_viewed', {
                          maddy_id: maddy.id,
                          maddy_name: maddy.name,
                          view_type: 'timetable'
                        });
                        navigate(`/maddys/${maddy.id}/timetable`);
                      }}
                      className="action-btn"
                      title="View Timetable"
                    >
                      📅
                    </button>
                    <button 
                      onClick={() => {
                        trackEvent('maddy_viewed', {
                          maddy_id: maddy.id,
                          maddy_name: maddy.name,
                          view_type: 'class_info'
                        });
                        navigate(`/maddys/${maddy.id}/class`);
                      }}
                      className="action-btn"
                      title="Class Info"
                    >
                      📚
                    </button>
                    <button 
                      onClick={() => {
                        trackEvent('maddy_viewed', {
                          maddy_id: maddy.id,
                          maddy_name: maddy.name,
                          view_type: 'attendance'
                        });
                        navigate("/attendance", { 
                          state: { 
                            friendCredentials: {
                              username: maddy.username,
                              password: maddy.password,
                              semester: maddy.semester,
                              academicYear: maddy.academicYear,
                              name: maddy.name
                            }
                          }
                        });
                      }}
                      className="action-btn"
                      title="Attendance"
                    >
                      📊
                    </button>
                    <button 
                      onClick={() => openDeleteConfirm(maddy)}
                      className="action-btn delete"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                
                <div className="maddy-info">
                  <p className="semester-info">
                    {getSemesterDisplayName(maddy.semester)} • {maddy.academicYear}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {maddys.length > 0 && (
          <div className="button-container">
            <button 
              onClick={() => setShowAddModal(true)} 
              className="secondary full-width-mobile"
            >
              Add Another Friend 👤
            </button>
          </div>
        )}
      </div>

      {/* Add Friend Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Add Your Maddy 👤</h2>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  resetAddForm();
                }}
                className="close-btn"
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <input
                placeholder="Friend's Username"
                value={friendUsername}
                onChange={(e) => setFriendUsername(e.target.value)}
                className="mb-16"
              />

              <input
                placeholder="Friend's Password"
                type="password"
                value={friendPassword}
                onChange={(e) => setFriendPassword(e.target.value)}
                className="mb-16"
              />

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="friendSemester">Semester</label>
                  <select
                    id="friendSemester"
                    value={friendSemester}
                    onChange={(e) => setFriendSemester(e.target.value)}
                    className="form-select"
                  >
                    <option value="odd">Odd Semester</option>
                    <option value="even">Even Semester</option>
                    <option value="summer">Summer Semester</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="friendAcademicYear">Academic Year</label>
                  <select
                    id="friendAcademicYear"
                    value={friendAcademicYear}
                    onChange={(e) => setFriendAcademicYear(e.target.value)}
                    className="form-select"
                  >
                    {getCurrentAcademicYearOptions().map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="captcha-container">
                <p className="mb-16">CAPTCHA takes 5–6 seconds to load. Please wait...</p>

                <div className="captcha-image-container">
                  {friendCaptchaUrl ? (
                    <img
                      src={friendCaptchaUrl}
                      alt="CAPTCHA"
                      className="captcha-image"
                      style={{ 
                        maxWidth: "100%", 
                        maxHeight: "100%", 
                        display: friendCaptchaLoading ? "none" : "block",
                        objectFit: "contain"
                      }}
                      onLoad={() => setFriendCaptchaLoading(false)}
                      onError={() => setFriendCaptchaLoading(false)}
                    />
                  ) : (
                    <span>No image URL</span>
                  )}
                  {friendCaptchaLoading && <span>Loading CAPTCHA...</span>}
                </div>

                <button
                  onClick={refreshFriendCaptcha}
                  className="mb-16"
                  style={{ fontSize: "14px", padding: "8px 16px" }}
                >
                  Reload CAPTCHA
                </button>

                <input
                  placeholder="Enter CAPTCHA"
                  value={friendCaptcha}
                  onChange={(e) => setFriendCaptcha(e.target.value)}
                  className="captcha-input"
                />
              </div>

              <div className="modal-actions">
                <button onClick={handleAddFriend} className="primary" disabled={isAddingFriend}>
                  {isAddingFriend ? "Adding..." : "Add Friend"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && deleteTarget && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Remove {deleteTarget.name}?</h2>
            </div>
            <div className="modal-body">
              <p className="mb-16">This will remove the friend and their saved timetable. Continue?</p>
              <div className="modal-actions">
                <button onClick={cancelDelete} className="secondary">
                  Cancel
                </button>
                <button onClick={confirmDelete} className="danger">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Name Modal */}
      {showNameModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Name Your Friend 👤</h2>
            </div>
            
            <div className="modal-body">
              <p>What would you like to call this friend?</p>
              <input
                placeholder="Enter name (max 10 characters)"
                value={friendName}
                onChange={(e) => setFriendName(e.target.value)}
                maxLength={10}
                className="mb-16"
              />

              <div className="modal-actions">
                <button onClick={handleSaveFriend} className="primary">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CaptchaModal
        isOpen={showCaptchaModal}
        onClose={() => setShowCaptchaModal(false)}
        onSuccess={handleCaptchaSuccess}
        friendCredentials={selectedMaddy ? {
          username: selectedMaddy.username,
          password: selectedMaddy.password,
          semester: selectedMaddy.semester,
          academicYear: selectedMaddy.academicYear,
          name: selectedMaddy.name
        } : null}
      />

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={closeToast}
      />

      {/* Resync options for a friend before CAPTCHA */}
      {showResyncOptions && selectedMaddy && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>ReSync {selectedMaddy.name}'s Timetable</h2>
            </div>

            <div className="modal-body">
              <p className="mb-16">Choose semester and academic year before syncing.</p>

              <div className="form-row" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label>Semester</label>
                  <select
                    value={resyncSemester}
                    onChange={(e) => setResyncSemester(e.target.value)}
                    className="form-select"
                  >
                    <option value="odd">Odd Semester</option>
                    <option value="even">Even Semester</option>
                    <option value="summer">Summer Semester</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Academic Year</label>
                  <select
                    value={resyncAcademicYear}
                    onChange={(e) => setResyncAcademicYear(e.target.value)}
                    className="form-select"
                  >
                    {Array.from(new Set([resyncAcademicYear, ...getCurrentAcademicYearOptions()])).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button onClick={closeResyncOptions} className="secondary">
                  Cancel
                </button>
                <button onClick={confirmResyncOptions} className="primary">
                  Continue to CAPTCHA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
