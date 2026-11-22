import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdPerson,
  MdCalendarMonth,
  MdSchool,
  MdPeople,
  MdEdit,
  MdEventNote,
  MdSchedule,
  MdInstallMobile,
  MdFeedback,
  MdInfo,
  MdLogout,
  MdPhotoCamera,
} from "react-icons/md";
import { FiGithub, FiLinkedin } from "react-icons/fi";
import NeoShell, { NeoModal } from "../Shell.jsx";
import { NeoField, NeoSelect, NeoButton } from "../NeoKit.jsx";
import { SettingsGroup, SettingsRow, Switch } from "../components/Settings.jsx";
import {
  AVATARS,
  avatarUrl,
  getAvatarSeed,
  setAvatarSeed as storeAvatarSeed,
  setCustomAvatar,
  deviceImageSource,
  pinterestImageSource,
} from "../utils/avatar.js";
import AvatarCropper from "../components/AvatarCropper.jsx";
import Toast from "../../components/Toast.jsx";
import { BUILD_ID } from "../../utils/buildInfo.js";
import { useInstallPrompt } from "../../hooks/useInstallPrompt.js";
import {
  clearCookies,
  clearCredentials,
  getCredentials,
  saveCredentials,
} from "../../../utils/storage.js";
import { getCurrentAcademicYearOptions } from "../../config/api.js";

const SEMESTER_NAMES = {
  odd: "Odd sem",
  even: "Even sem",
  summer: "Summer",
  term3: "Term 3",
};

export default function NeoProfile() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [semester, setSemester] = useState("odd");
  const [academicYear, setAcademicYear] = useState("");
  const [yearOptions, setYearOptions] = useState([]);
  const [avatarSeed, setAvatarSeed] = useState(getAvatarSeed);
  const [sheet, setSheet] = useState(null); // "account" | "semester" | "about" | "avatar" | null
  const [pinLink, setPinLink] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [cropSrc, setCropSrc] = useState(""); // picture waiting to be cropped
  const fileInputRef = useRef(null);
  const { canInstall, install } = useInstallPrompt();
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [timeFormat, setTimeFormat] = useState(
    () => localStorage.getItem("time_format") || "12"
  );
  const credsSnapshotRef = useRef({ username: "", password: "" });

  // feedback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState("Bug/Issue");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const creds = getCredentials();
    if (creds) {
      setUsername(creds.username || "");
      setPassword(creds.password || "");
      credsSnapshotRef.current = {
        username: creds.username || "",
        password: creds.password || "",
      };
    }

    const storedSemester = localStorage.getItem("semester") || "odd";
    const validSemesters = new Set(["odd", "even", "summer", "term3"]);
    setSemester(validSemesters.has(storedSemester) ? storedSemester : "odd");

    const currentYear = new Date().getFullYear();
    const defaultYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
    const storedYear = localStorage.getItem("academicYear") || defaultYear;
    setAcademicYear(storedYear);
    setYearOptions(Array.from(new Set([storedYear, ...getCurrentAcademicYearOptions()])));
  }, []);

  const pickPreset = (seed) => {
    setAvatarSeed(seed);
    storeAvatarSeed(seed);
    setAvatarError("");
    setSheet(null);
  };

  const closeCropper = () => {
    if (cropSrc.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    setCropSrc("");
  };

  const handlePinterest = async (e) => {
    e.preventDefault();
    if (!pinLink.trim()) {
      setAvatarError("Paste a Pinterest pin or profile link.");
      return;
    }
    setAvatarBusy(true);
    setAvatarError("");
    try {
      setCropSrc(await pinterestImageSource(pinLink));
    } catch (error) {
      setAvatarError(error.message || "Couldn't read that link.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleFilePicked = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setAvatarError("");
      setCropSrc(deviceImageSource(file));
    } catch (error) {
      setAvatarError(error.message);
    }
  };

  const handleCropSaved = (dataUrl) => {
    setCustomAvatar(dataUrl);
    setAvatarSeed(getAvatarSeed());
    closeCropper();
    setPinLink("");
    setSheet(null);
    setToast({ show: true, message: "Profile picture updated.", type: "success" });
  };

  const toggleTimeFormat = () =>
    setTimeFormat((prev) => {
      const next = prev === "12" ? "24" : "12";
      localStorage.setItem("time_format", next);
      return next;
    });

  const handleSaveCreds = () => {
    const snapshot = credsSnapshotRef.current;
    const credsChanged =
      username.trim() !== snapshot.username || password !== snapshot.password;

    if (credsChanged) {
      clearCookies();
    }

    saveCredentials({ username: username.trim(), password });
    credsSnapshotRef.current = { username: username.trim(), password };
    setSheet(null);
    setToast({ show: true, message: "Credentials saved.", type: "success" });
  };

  const handleSemesterChange = (value) => {
    setSemester(value);
    localStorage.setItem("semester", value);
  };

  const handleAcademicYearChange = (value) => {
    setAcademicYear(value);
    localStorage.setItem("academicYear", value);
  };

  const confirmLogout = () => {
    clearCredentials();
    clearCookies();
    ["timetable", "timetable_last_sync", "examMode", "seatingPlan", "cached_attendance", "cached_attendance_time"]
      .forEach((key) => localStorage.removeItem(key));
    navigate("/");
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!navigator.onLine) {
      setToast({ show: true, message: "You are offline. Connect to send feedback.", type: "error" });
      return;
    }
    if (!description.trim()) {
      setToast({ show: true, message: "Description cannot be empty.", type: "error" });
      return;
    }

    setIsSubmitting(true);

    const formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSdaATurLdf2plEOpdDZNVAm4U8Ws7WLv4uu9LwmRBQM5LAUzg/formResponse';
    const formData = new FormData();
    formData.append('entry.1620430637', feedbackType);
    formData.append('entry.1057660527', description);
    const submittedContact = username ? `${contact}:${username}` : contact;
    formData.append('entry.1959359017', submittedContact);

    try {
      await fetch(formUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: formData,
      });

      setShowFeedback(false);
      setDescription("");
      setContact("");
      setFeedbackType("Bug/Issue");
      setToast({ show: true, message: "Feedback sent. Thank you!", type: "success" });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setToast({ show: true, message: "Failed to send feedback. Try again.", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const savedId = credsSnapshotRef.current.username;

  return (
    <NeoShell>
      <header className="np-profile">
        <button
          className="np-profile__avatar"
          onClick={() => {
            setAvatarError("");
            setSheet("avatar");
          }}
          aria-label="Change avatar"
          title="Change avatar"
        >
          <img src={avatarUrl(avatarSeed)} alt="" />
          <span className="np-profile__badge" aria-hidden="true">
            <MdPhotoCamera size={16} />
          </span>
        </button>
        <h1 className="np-profile__name">{savedId || "Guest"}</h1>
        <p className="np-profile__meta">
          {SEMESTER_NAMES[semester] || semester} · {academicYear}
        </p>
      </header>

      <SettingsGroup title="You">
        <SettingsRow
          icon={<MdPerson size={24} />}
          title="Account"
          description={savedId ? "ERP ID and password" : "Add your ERP ID and password"}
          onClick={() => setSheet("account")}
        />
        <SettingsRow
          icon={<MdCalendarMonth size={24} />}
          title="Semester"
          description={`${SEMESTER_NAMES[semester] || semester} · ${academicYear}`}
          onClick={() => setSheet("semester")}
        />
      </SettingsGroup>

      <SettingsGroup title="Study">
        <SettingsRow
          icon={<MdSchool size={24} />}
          title="Grades"
          description="CGPA, SGPA and marks"
          onClick={() => navigate("/grades")}
        />
        <SettingsRow
          icon={<MdPeople size={24} />}
          title="Docs"
          description="Friends' timetables and attendance"
          onClick={() => navigate("/maddys")}
        />
        <SettingsRow
          icon={<MdEdit size={24} />}
          title="Subject names"
          description="Short nicknames for course codes"
          onClick={() => navigate("/subjects")}
        />
        <SettingsRow
          icon={<MdEventNote size={24} />}
          title="Exams"
          description="Exam dates and seating"
          onClick={() => navigate("/exam")}
        />
      </SettingsGroup>

      <SettingsGroup title="App">
        <SettingsRow
          icon={<MdSchedule size={24} />}
          title="24-hour time"
          description={timeFormat === "24" ? "Showing 13:50" : "Showing 1:50 PM"}
          role="switch"
          aria-checked={timeFormat === "24"}
          trailing={<Switch on={timeFormat === "24"} />}
          onClick={toggleTimeFormat}
        />
        {canInstall && (
          <SettingsRow
            icon={<MdInstallMobile size={24} />}
            title="Install app"
            description="Add TimeTable to your home screen"
            onClick={install}
          />
        )}
        <SettingsRow
          icon={<MdFeedback size={24} />}
          title="Send feedback"
          description="Report a bug or suggest an idea"
          onClick={() => setShowFeedback(true)}
        />
        <SettingsRow
          icon={<MdInfo size={24} />}
          title="About"
          description="Local-first, made at KL"
          onClick={() => setSheet("about")}
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          icon={<MdLogout size={24} />}
          title="Log out"
          description="Clears your data from this device"
          danger
          trailing={null}
          onClick={() => setShowLogoutConfirm(true)}
        />
      </SettingsGroup>

      {/* account sheet */}
      <NeoModal open={sheet === "account"} title="Account" onClose={() => setSheet(null)}>
        <p className="np-note" style={{ marginBottom: 16 }}>
          Your ERP login. It is stored on this device only.
        </p>
        <NeoField
          id="np-prof-user"
          label="University ID"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <NeoField
          id="np-prof-pass"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <NeoButton type="button" onClick={handleSaveCreds}>
          Save
        </NeoButton>
      </NeoModal>

      {/* profile picture sheet */}
      <NeoModal
        open={sheet === "avatar"}
        title={cropSrc ? "Crop picture" : "Profile picture"}
        onClose={() => {
          closeCropper();
          setSheet(null);
        }}
      >
        {cropSrc ? (
          <AvatarCropper src={cropSrc} onSave={handleCropSaved} onCancel={closeCropper} />
        ) : (
        <>
        <div className="np-avatarpick">
          {AVATARS.map((name) => (
            <button
              key={name}
              type="button"
              className={`np-avatarpick__item${avatarSeed === name ? " is-on" : ""}`}
              onClick={() => pickPreset(name)}
              aria-label={`Use ${name}`}
            >
              <img src={avatarUrl(name)} alt="" draggable={false} />
            </button>
          ))}
        </div>

        <form onSubmit={handlePinterest} style={{ marginTop: 18 }}>
          <NeoField
            id="np-pin-link"
            label="Pinterest link"
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="pin.it/… or a Pinterest profile"
            value={pinLink}
            onChange={(e) => setPinLink(e.target.value)}
          />
          {avatarError && <p className="np-formerror" role="alert">{avatarError}</p>}
          <NeoButton loading={avatarBusy} loadingText="Fetching…">
            Use this picture
          </NeoButton>
        </form>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleFilePicked}
        />
        <button
          type="button"
          className="np-avatarpick__upload"
          disabled={avatarBusy}
          onClick={() => fileInputRef.current?.click()}
        >
          Choose from this device
        </button>
        </>
        )}
      </NeoModal>

      {/* semester sheet */}
      <NeoModal open={sheet === "semester"} title="Semester" onClose={() => setSheet(null)}>
        <p className="np-note" style={{ marginBottom: 16 }}>
          Used for every sync and fetch across the app.
        </p>
        <div className="np-row">
          <NeoSelect
            id="np-prof-sem"
            label="Semester"
            value={semester}
            onChange={(e) => handleSemesterChange(e.target.value)}
          >
            <option value="odd">Odd</option>
            <option value="even">Even</option>
            <option value="summer">Summer</option>
            <option value="term3">Term 3</option>
          </NeoSelect>
          <NeoSelect
            id="np-prof-year"
            label="Academic year"
            value={academicYear}
            onChange={(e) => handleAcademicYearChange(e.target.value)}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </NeoSelect>
        </div>
        <NeoButton type="button" onClick={() => setSheet(null)}>
          Done
        </NeoButton>
      </NeoModal>

      {/* about sheet */}
      <NeoModal open={sheet === "about"} title="About" onClose={() => setSheet(null)}>
        <p className="np-note">
          Local-first PWA for KL University students. Your data never leaves this
          device. Fully vibecoded.
        </p>
        <p className="np-note" style={{ marginTop: 8 }}>
          Developed by{" "}
          <a
            href="https://dhanushkotturu.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--np-cream)", fontWeight: 600 }}
          >
            Dhanush Kotturu
          </a>
          .
        </p>
        <p className="np-note" style={{ marginTop: 8 }}>
          <a
            href="http://timetableklbenchmarks.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--np-cream)", fontWeight: 600 }}
          >
            Performance benchmarks
          </a>
        </p>
        <div className="np-social">
          <a
            href="https://www.linkedin.com/in/kotturu-siva-dhanush-646b51322"
            target="_blank"
            rel="noopener noreferrer"
            title="LinkedIn"
            aria-label="LinkedIn"
          >
            <FiLinkedin size={16} />
          </a>
          <a
            href="https://github.com/sivadhanushreddykotturu"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub"
            aria-label="GitHub"
          >
            <FiGithub size={16} />
          </a>
        </div>
        <p className="np-note np-dim" style={{ marginTop: 14 }}>Build {BUILD_ID}</p>
      </NeoModal>

      {/* feedback modal */}
      <NeoModal open={showFeedback} title="Send feedback" onClose={() => setShowFeedback(false)}>
        <form onSubmit={handleFeedbackSubmit}>
          <NeoSelect
            id="np-fb-type"
            label="What is this about?"
            value={feedbackType}
            onChange={(e) => setFeedbackType(e.target.value)}
          >
            <option>Bug/Issue</option>
            <option>Suggestion/Idea</option>
            <option>Other</option>
          </NeoSelect>

          <div className="np-field">
            <div className="np-field__head">
              <label className="np-field__label" htmlFor="np-fb-desc">Describe it</label>
            </div>
            <textarea
              id="np-fb-desc"
              className="np-field__input"
              rows="5"
              placeholder="Your feedback…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              style={{ resize: "vertical" }}
            />
          </div>

          <NeoField
            id="np-fb-contact"
            label="Contact"
            placeholder="Email or phone"
            value={contact}
            required
            onChange={(e) => setContact(e.target.value)}
          />

          <NeoButton loading={isSubmitting} loadingText="Sending…">
            Submit feedback
          </NeoButton>
        </form>
      </NeoModal>

      {/* logout confirm */}
      <NeoModal open={showLogoutConfirm} title="Log out?" onClose={() => setShowLogoutConfirm(false)}>
        <p className="np-note" style={{ marginBottom: 16 }}>
          This clears your credentials and timetable from this device.
        </p>
        <div className="np-modal__actions">
          <button type="button" className="np-btn np-btn--quiet" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
          <button type="button" className="np-btn np-btn--pink" onClick={confirmLogout}>Log out</button>
        </div>
      </NeoModal>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </NeoShell>
  );
}
