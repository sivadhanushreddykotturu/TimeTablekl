import React from "react";
import { NeoModal } from "../Shell.jsx";
import { NeoButton } from "../NeoKit.jsx";
import { describeAnnouncement } from "../../utils/announcement.js";

/** The full text of an announcement, in the app's standard sheet / dialog. */
export default function AnnouncementSheet({ announcement, open, onClose, onConfirm, confirmLabel = "Got it" }) {
  if (!announcement) return null;
  const { type, label, title, message } = describeAnnouncement(announcement);

  return (
    <NeoModal open={open} title="Announcement" onClose={onClose}>
      <div className={`np-notice--${type}`}>
        <div className="np-notice-sheet__eyebrow">{label}</div>
      </div>
      <h3 className="np-notice-sheet__title">{title}</h3>
      {message && <p className="np-notice-sheet__text">{message}</p>}
      <NeoButton type="button" onClick={onConfirm || onClose}>
        {confirmLabel}
      </NeoButton>
    </NeoModal>
  );
}
