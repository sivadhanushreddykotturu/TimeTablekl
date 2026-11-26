import React, { useState } from "react";
import axios from "axios";
import { NeoButton, NeoField, NeoSelect } from "../NeoKit.jsx";
import { saveCredentials, saveCookies } from "../../../utils/storage.js";
import { getFormData, API_CONFIG, getCurrentAcademicYearOptions } from "../../config/api.js";
import { refreshHostelStatus } from "../../utils/hostel.js";

const SEMESTERS = ["odd", "even", "summer", "term3"];
const WRONG_LOGIN = "Wrong ID or password. Check them and try again.";

function defaultYear() {
  const year = new Date().getFullYear();
  return `${year}-${(year + 1).toString().slice(-2)}`;
}

/** Turns whatever the backend said into one clear line. */
function readableError(message, status) {
  const text = (message || "").toLowerCase();
  if (status === 500 || status === 401 || /invalid|credential|password|unauthorized/.test(text)) {
    return WRONG_LOGIN;
  }
  return message || "Couldn't reach ERP. Check your connection and try again.";
}

/**
 * The one ERP login form (login screen and the guest sheets both use it).
 * On success the credentials, session and timetable are stored and
 * `onSuccess(responseData)` is called.
 */
export default function LoginForm({ idPrefix = "np-login", submitLabel = "Log in", onSuccess, onError }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [semester, setSemester] = useState(() => {
    const stored = localStorage.getItem("semester");
    return SEMESTERS.includes(stored) ? stored : "odd";
  });
  const [academicYear, setAcademicYear] = useState(() => localStorage.getItem("academicYear") || defaultYear());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const yearOptions = Array.from(new Set([academicYear, defaultYear(), ...getCurrentAcademicYearOptions()]));

  const fail = (message) => {
    setError(message);
    onError?.(message);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const id = username.trim();
    if (!id || !password) {
      fail("Enter your University ID and password.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const form = getFormData(id, password, "", semester, academicYear, "");
      const res = await axios.post(API_CONFIG.FETCH_URL, form);

      if (!res.data?.success) {
        fail(readableError(res.data?.message));
        return;
      }

      saveCredentials({ username: id, password });
      if (res.data.cookies) saveCookies(res.data.cookies);
      setTimeout(() => refreshHostelStatus({ force: true }), 2500); // after the first screen has loaded
      if (res.data.timetable) localStorage.setItem("timetable", JSON.stringify(res.data.timetable));
      localStorage.setItem("semester", semester);
      localStorage.setItem("academicYear", academicYear);
      await onSuccess?.(res.data);
    } catch (err) {
      fail(readableError(err.response?.data?.detail || err.response?.data?.message, err.response?.status));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <NeoField
        id={`${idPrefix}-user`}
        label="University ID"
        inputMode="numeric"
        placeholder="2400030001"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <NeoField
        id={`${idPrefix}-pass`}
        label="Password"
        type="password"
        placeholder="Your ERP password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <div className="np-row">
        <NeoSelect
          id={`${idPrefix}-sem`}
          label="Semester"
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
        >
          <option value="odd">Odd</option>
          <option value="even">Even</option>
          <option value="summer">Summer</option>
          <option value="term3">Term 3</option>
        </NeoSelect>
        <NeoSelect
          id={`${idPrefix}-year`}
          label="Academic year"
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
        >
          {yearOptions.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </NeoSelect>
      </div>

      {error && <p className="np-formerror" role="alert">{error}</p>}

      <NeoButton loading={busy} loadingText="Logging in…">
        {submitLabel}
      </NeoButton>

      <p className="np-formnote">Your login is stored on this device only and is sent just to KL ERP.</p>
    </form>
  );
}
