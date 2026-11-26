// One POST to a backend ERP endpoint, carrying the saved ERP login and session cookies.
// Errors come back as Error(message) with .status (HTTP code) and .code ("NO_LOGIN" when nobody is logged in).
import axios from "axios";
import { getFormData } from "../config/api.js";
import { getCredentials, handleSessionRefresh } from "../../utils/storage.js";

export function requireLogin() {
  const creds = getCredentials();
  if (!creds) {
    const error = new Error("Add your ERP login in Profile to use this.");
    error.code = "NO_LOGIN";
    throw error;
  }
  return creds;
}

export async function erpCall(url, fields = {}) {
  const creds = requireLogin();
  const form = getFormData(
    creds.username,
    creds.password,
    "",
    localStorage.getItem("semester") || "odd",
    localStorage.getItem("academicYear") || "2026-27",
    ""
  );
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));

  try {
    const res = await axios.post(url, form);
    handleSessionRefresh(res.data);
    return res.data;
  } catch (err) {
    const detail = err.response?.data?.detail;
    const error = new Error(
      typeof detail === "string"
        ? detail
        : err.response
          ? "The ERP didn't accept that. Please try again."
          : "Can't reach the server. Check your connection."
    );
    error.status = err.response?.status;
    throw error;
  }
}
