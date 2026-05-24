import axios from "axios";
import { getCredentials, handleSessionRefresh } from "./storage.js";
import { getFormData, API_CONFIG } from "../src/config/api.js";

export const syncTimetable = async (friendCredentials = null) => {
  const creds = friendCredentials || getCredentials();
  if (!creds) {
    throw new Error("Session expired. Please log in again.");
  }

  const semester = friendCredentials ? friendCredentials.semester : (localStorage.getItem("semester") || "odd");
  const academicYear = friendCredentials ? friendCredentials.academicYear : (localStorage.getItem("academicYear") || "2024-25");

  const form = getFormData(creds.username, creds.password, "", semester, academicYear, "");
  const res = await axios.post(API_CONFIG.FETCH_URL, form);

  if (res.data.success) {
    if (!friendCredentials) {
      handleSessionRefresh(res.data);
      localStorage.setItem("timetable", JSON.stringify(res.data.timetable));
    }
    return res.data.timetable;
  } else {
    throw new Error(res.data.message || "Failed to resync. Please try again.");
  }
};
