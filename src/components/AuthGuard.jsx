import React from "react";
import { Navigate } from "react-router-dom";
import { getCredentials } from "../../utils/storage.js";
import { hasExamSeating } from "../utils/slotTimes";

/**
 * Wraps the login route: signed-in users go straight to their day.
 * Decided synchronously from localStorage, so there is no loading flash.
 */
export default function AuthGuard({ children }) {
  const signedIn = Boolean(getCredentials() && localStorage.getItem("timetable"));
  if (!signedIn) return children;

  const examMode = localStorage.getItem("examMode") === "true" && hasExamSeating();
  return <Navigate to={examMode ? "/exam" : "/home"} replace />;
}
