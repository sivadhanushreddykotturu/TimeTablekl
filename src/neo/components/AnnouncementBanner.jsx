import React, { useEffect, useState } from "react";
import { MdChevronRight, MdClose } from "react-icons/md";
import AnnouncementSheet from "./AnnouncementSheet.jsx";
import { describeAnnouncement, fetchAnnouncement } from "../../utils/announcement.js";

const DISMISSED_KEY = "announcement_dismissed";

/**
 * A single quiet line under the Today header. Tapping it opens the full text
 * in a sheet, so even a very long announcement never pushes the page around.
 * The X (or "Got it") hides that particular notice; a new one shows again.
 * (On desktop the mascot delivers it instead, so this hides itself there.)
 */
export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAnnouncement().then((data) => {
      if (cancelled || !data) return;
      if (localStorage.getItem(DISMISSED_KEY) !== data.id) setAnnouncement(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!announcement) return null;

  const { type, Icon, title } = describeAnnouncement(announcement);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, announcement.id);
    setSheetOpen(false);
    setLeaving(true);
    setTimeout(() => setAnnouncement(null), 220);
  };

  return (
    <>
      <aside
        className={`np-notice np-notice--${type} np-announce-banner${leaving ? " is-leaving" : ""}`}
        role="status"
      >
        <button
          type="button"
          className="np-notice__main"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
        >
          <span className="np-notice__icon" aria-hidden="true">
            <Icon size={18} />
          </span>
          <span className="np-notice__title">{title}</span>
          <MdChevronRight className="np-notice__chev" size={20} aria-hidden="true" />
        </button>
        <button className="np-notice__close" onClick={dismiss} aria-label="Dismiss announcement">
          <MdClose size={18} />
        </button>
      </aside>

      <AnnouncementSheet
        announcement={announcement}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onConfirm={dismiss}
      />
    </>
  );
}
