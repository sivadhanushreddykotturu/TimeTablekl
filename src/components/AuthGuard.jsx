import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCredentials } from "../../utils/storage.js";

export default function AuthGuard({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user has credentials and timetable data
    const credentials = getCredentials();
    const timetable = localStorage.getItem("timetable");
    
    if (credentials && timetable) {
      // User is logged in, redirect to home
      navigate("/home", { replace: true });
    } else {
      // User is not logged in, stay on current page (login)
      setIsLoading(false);
    }
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return children;
} 