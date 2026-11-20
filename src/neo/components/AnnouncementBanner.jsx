import React, { useEffect, useState } from "react";
import { MdCampaign, MdClose } from "react-icons/md";

const DISMISSED_KEY = "announcement_dismissed";

/**
 * A notice the team can switch on by editing public/announcements.json
 * ({ active, title, message }) — e.g. when ERP is down. Dismissing hides
 * that particular notice; a new one shows again.
 * (On desktop the mascot delivers it instead, so this hides itself there.)
 */
export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/announcements.json?t=${Date.now()}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.active) return;
        const id = `${data.title || ""}|${data.message || ""}`;
        if (localStorage.getItem(DISMISSED_KEY) !== id) setAnnouncement({ ...data, id });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!announcement) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, announcement.id);
    setAnnouncement(null);
  };

  return (
    <aside className="np-announce np-announce-banner" role="status">
      <MdCampaign className="np-announce__icon" size={22} aria-hidden="true" />
      <div className="np-announce__body">
        <div className="np-announce__title">{announcement.title || "Announcement"}</div>
        <p className="np-announce__text">{announcement.message}</p>
      </div>
      <button className="np-toast__close" onClick={dismiss} aria-label="Dismiss announcement">
        <MdClose size={17} />
      </button>
    </aside>
  );
}
