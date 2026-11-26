// Whether this student lives in the hostel, read once from the ERP profile's "Hostel Status" (/fetch-profile).
//
// Three states, saved on this device per ERP ID:
//   "yes"      the ERP says hostler          -> the Outpass entry opens the outpass screen
//   "no"       anything else (day scholar)   -> the Outpass entry is hidden for good
//   "unknown"  never checked (or the last check failed) -> the entry is shown; tapping it runs the check once
//
// A failed check (network / ERP down) is never saved as "no", or a hosteler would lose the feature.
// Login re-checks quietly, so someone who moves into the hostel later is picked up.
import { useEffect, useState } from "react";
import axios from "axios";
import { API_CONFIG, getFormData } from "../config/api.js";
import { getCredentials, handleSessionRefresh } from "../../utils/storage.js";

// Local testing only: VITE_FORCE_HOSTLER=true treats any logged-in ID as a hostler. Ignored in production builds.
const FORCED = import.meta.env.DEV && import.meta.env.VITE_FORCE_HOSTLER === "true";

const KEY = "hostel_status_v1";
const TTL = 7 * 24 * 60 * 60 * 1000;
const EVENT = "hostel-status-changed";

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
};

const cachedFor = (creds) => {
  const cached = read();
  return creds && cached && cached.username === creds.username ? cached : null;
};

export const hostelEnabled = () => Boolean(API_CONFIG.PROFILE_URL);

/** "yes" | "no" | "unknown" for the logged-in ID, straight from this device. */
export function hostelState() {
  if (FORCED && getCredentials()) return "yes";
  const cached = cachedFor(getCredentials());
  if (!cached) return "unknown";
  return cached.isHosteller ? "yes" : "no";
}

export function clearHostelStatus() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Asks the ERP and saves the answer. Throws if the ERP could not be reached or gave no clear answer. */
async function askErp(creds) {
  const form = getFormData(
    creds.username,
    creds.password,
    "",
    localStorage.getItem("semester") || "odd",
    localStorage.getItem("academicYear") || "2026-27",
    ""
  );
  const res = await axios.post(API_CONFIG.PROFILE_URL, form);
  if (!res.data?.success || typeof res.data.hostel?.is_hosteller !== "boolean") {
    throw new Error("No clear hostel answer from the ERP");
  }
  handleSessionRefresh(res.data);
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        username: creds.username,
        isHosteller: res.data.hostel.is_hosteller,
        status: res.data.hostel.status || "",
        at: Date.now(),
      })
    );
  } catch {
    /* storage unavailable: the answer just isn't remembered */
  }
  window.dispatchEvent(new Event(EVENT));
  return res.data.hostel.is_hosteller;
}

/** The one-time check behind the Outpass tap. Uses the saved answer when there is one. -> "yes" | "no" | "error" */
export async function checkHostel() {
  const creds = getCredentials();
  if (!creds || !hostelEnabled()) return "error";
  const saved = hostelState();
  if (saved !== "unknown") return saved;
  try {
    return (await askErp(creds)) ? "yes" : "no";
  } catch {
    return "error";
  }
}

/** Quiet re-check (after login, or when a saved answer is a week old). A failure keeps whatever was saved. */
export async function refreshHostelStatus({ force = false } = {}) {
  const creds = getCredentials();
  if (FORCED || !creds || !hostelEnabled()) return;
  const cached = cachedFor(creds);
  if (!force && (!cached || Date.now() - cached.at < TTL)) return;
  try {
    await askErp(creds);
  } catch {
    /* keep the last known answer */
  }
}

/** React: "yes" | "no" | "unknown", kept in step with this device's saved answer. */
export function useHostelState() {
  const [state, setState] = useState(hostelState);

  useEffect(() => {
    const sync = () => setState(hostelState());
    window.addEventListener(EVENT, sync);
    sync();
    refreshHostelStatus();
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  return state;
}
