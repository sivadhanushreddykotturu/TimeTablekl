import React, { useState, useEffect } from "react";
import axios from "axios";
import { getCSSColor } from "../utils/themeEngine";

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState(null);

  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        const res = await axios.get(`/announcements.json?t=${Date.now()}`);
        if (res.data && res.data.active) {
          setAnnouncement(res.data);
        } else {
          setAnnouncement(null);
        }
      } catch {
        setAnnouncement(null);
      }
    };
    fetchAnnouncement();
  }, []);

  if (!announcement || !announcement.active) return null;

  return (
    <div
      className="np-board"
      style={{
        borderColor: "var(--np-acid)",
        background: "rgba(207, 255, 4, 0.05)",
        padding: "16px 14px 12px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
        marginTop: "16px",
      }}
    >
      <div
        style={{
          font: "700 11px/1.4 var(--np-font-ui)",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--np-acid)",
          paddingTop: "2px",
        }}
      >
        {announcement.title || "🎉 ANNOUNCEMENT 🎉"}
      </div>
      <div
        style={{
          fontSize: "11px",
          color: "var(--np-cream)",
          fontFamily: "var(--np-font-ui)",
          lineHeight: "1.4",
        }}
      >
        {announcement.message}
      </div>
    </div>
  );
}
