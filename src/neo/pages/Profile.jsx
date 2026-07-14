import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiEdit3,
  FiZap,
  FiMessageSquare,
  FiLogOut,
  FiGithub,
  FiLinkedin,
  FiRefreshCw,
} from "react-icons/fi";
import NeoShell, { NeoModal } from "../Shell.jsx";
import { NeoField, NeoSelect, NeoButton } from "../NeoKit.jsx";
import Toast from "../../components/Toast.jsx";
import {
  clearCookies,
  clearCredentials,
  getCredentials,
  saveCredentials,
} from "../../../utils/storage.js";
import { getCurrentAcademicYearOptions } from "../../config/api.js";

const SEMESTER_NAMES = {
  odd: "odd sem",
  even: "even sem",
  summer: "summer",
  term3: "term 3",
};

export default function NeoProfile() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [semester, setSemester] = useState("odd");
  const [academicYear, setAcademicYear] = useState("");
  const [yearOptions, setYearOptions] = useState([]);
  const [avatarSeed, setAvatarSeed] = useState(
    () => localStorage.getItem("avatarSeed") || Math.random().toString(36).substring(7)
  );
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
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

  useEffect(() => {
    localStorage.setItem("avatarSeed", avatarSeed);
  }, [avatarSeed]);

  const handleRandomizeAvatar = () => {
    if (!navigator.onLine) return;
    setAvatarSeed(Math.random().toString(36).substring(7));
  };

  const handleSaveCreds = () => {
    const snapshot = credsSnapshotRef.current;
    const credsChanged =
      username.trim() !== snapshot.username || password !== snapshot.password;

    if (credsChanged) {
      clearCookies();
    }

    saveCredentials({ username: username.trim(), password });
    credsSnapshotRef.current = { username: username.trim(), password };
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
    localStorage.removeItem("timetable");
    localStorage.removeItem("examMode");
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
    formData.append('entry.1959359017', contact);

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

  return (
    <NeoShell>
      <div className="np-pagehead">
        <span className="np-eyebrow">your space</span>
        <h1 className="np-pagehead__title">profile<i>.</i></h1>
      </div>

      <div className="np-profile-head">
        <span className="np-avatar">
          <img
            src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${avatarSeed}&backgroundColor=transparent`}
            alt="Avatar"
          />
        </span>
        <div>
          <div className="np-profile-head__id">{username || "student"}</div>
          <div className="np-profile-head__meta">
            {SEMESTER_NAMES[semester] || semester} · {academicYear}
          </div>
          <button className="np-minibtn" style={{ marginTop: 8 }} onClick={handleRandomizeAvatar}>
            <FiRefreshCw size={10} style={{ marginRight: 5 }} />
            new avatar
          </button>
        </div>
      </div>

      {/* credentials */}
      <section className="np-panel">
        <div className="np-panel__label">erp credentials</div>
        <NeoField
          id="np-prof-user"
          label="university id"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <NeoField
          id="np-prof-pass"
          label="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <NeoButton type="button" onClick={handleSaveCreds}>
          save credentials
        </NeoButton>
      </section>

      {/* semester */}
      <section className="np-panel">
        <div className="np-panel__label">active semester</div>
        <div className="np-row">
          <NeoSelect
            id="np-prof-sem"
            label="semester"
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
            label="academic year"
            value={academicYear}
            onChange={(e) => handleAcademicYearChange(e.target.value)}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </NeoSelect>
        </div>
        <p className="np-note">Used for every resync and fetch across the app.</p>
      </section>

      {/* quick actions */}
      <div className="np-panel__label" style={{ margin: "20px 0 10px" }}>tools</div>

      <button className="np-linkrow" onClick={() => navigate("/subjects")}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <FiEdit3 size={15} /> manage subject names
        </span>
        <span className="np-linkrow__go">→</span>
      </button>

      <button
        className="np-linkrow"
        onClick={() => {
          localStorage.setItem("examMode", "true");
          navigate("/exam");
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <FiZap size={15} /> exam mode
        </span>
        <span className="np-linkrow__go">→</span>
      </button>

      <button className="np-linkrow" onClick={() => setShowFeedback(true)}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <FiMessageSquare size={15} /> send feedback
        </span>
        <span className="np-linkrow__go">→</span>
      </button>

      <button className="np-linkrow np-linkrow--danger" onClick={() => setShowLogoutConfirm(true)}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <FiLogOut size={15} /> log out
        </span>
        <span className="np-linkrow__go" style={{ color: "var(--np-pink)" }}>→</span>
      </button>

      {/* about */}
      <section className="np-panel" style={{ marginTop: 20 }}>
        <div className="np-panel__label">about</div>
        <p className="np-note">
          local-first PWA for KL University students. your data never leaves this
          device. fully vibecoded.
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
      </section>

      {/* feedback modal */}
      <NeoModal open={showFeedback} title="send feedback" onClose={() => setShowFeedback(false)}>
        <form onSubmit={handleFeedbackSubmit}>
          <NeoSelect
            id="np-fb-type"
            label="what is this about?"
            value={feedbackType}
            onChange={(e) => setFeedbackType(e.target.value)}
          >
            <option>Bug/Issue</option>
            <option>Suggestion/Idea</option>
            <option>Other</option>
          </NeoSelect>

          <div className="np-field">
            <div className="np-field__head">
              <label className="np-field__label" htmlFor="np-fb-desc">describe it</label>
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
            label="contact"
            placeholder="email or phone"
            value={contact}
            required
            onChange={(e) => setContact(e.target.value)}
          />

          <NeoButton loading={isSubmitting} loadingText="sending…">
            submit feedback
          </NeoButton>
        </form>
      </NeoModal>

      {/* logout confirm */}
      <NeoModal open={showLogoutConfirm} title="log out?" onClose={() => setShowLogoutConfirm(false)}>
        <p className="np-note" style={{ marginBottom: 16 }}>
          This clears your credentials and timetable from this device.
        </p>
        <div className="np-modal__actions">
          <button className="secondary" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
          <button className="danger" onClick={confirmLogout}>Log out</button>
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
