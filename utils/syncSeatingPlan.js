import axios from "axios";
import { getCredentials, handleSessionRefresh } from "./storage.js";
import { getSeatingFormData, API_CONFIG } from "../src/config/api.js";

/**
 * Fetches the exam seating plan from ERP, stores it, and returns it. Throws with a readable message.
 * Pass a friend ({ username, password }) to just read theirs: nothing of yours is touched or saved.
 */
export const syncSeatingPlan = async (friend = null) => {
  const creds = friend || getCredentials();
  if (!creds) {
    throw new Error("Session expired. Please log in again.");
  }

  let res;
  try {
    const form = getSeatingFormData(creds.username, creds.password, "", "", friend ? { useStoredCookies: false } : {});
    res = await axios.post(API_CONFIG.SEATING_URL, form);
  } catch (error) {
    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.message ||
        "Something went wrong. Please try again."
    );
  }

  if (!res.data.success) {
    throw new Error(res.data.message || "Failed to sync. Please try again.");
  }

  const plan = res.data.seating_plan || [];
  if (friend) return plan;

  handleSessionRefresh(res.data);
  localStorage.setItem("seatingPlan", JSON.stringify(plan));
  return plan;
};
