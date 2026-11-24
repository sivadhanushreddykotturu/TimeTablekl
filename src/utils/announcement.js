import { MdErrorOutline, MdInfoOutline, MdCheckCircleOutline, MdWarningAmber } from "react-icons/md";

/**
 * Where announcements come from.
 *
 * The team edits announcements.json on the `announcements` branch of the repo
 * (GitHub's web editor is enough; no app deploy needed). It is read straight
 * from GitHub's raw CDN, which caches for a few minutes. If that can't be
 * reached, the copy shipped with the app (public/announcements.json) is used.
 *
 * Shape: { active, type?: info|warning|critical|success, title, message }
 */
/** Folder on the `announcements` branch that holds announcements.json, theme.json and theme images. */
export const BRANCH_BASE =
  "https://raw.githubusercontent.com/sivadhanushreddykotturu/TimeTablekl/announcements/";
const BRANCH_URL = `${BRANCH_BASE}announcements.json`;

async function getJson(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The announcement that is currently active, or null. */
export async function fetchAnnouncement() {
  const data =
    (await getJson(BRANCH_URL, 4000)) || (await getJson(`/announcements.json?t=${Date.now()}`, 4000));
  if (!data?.active) return null;
  return { ...data, id: `${data.title || ""}|${data.message || ""}` };
}

const TYPES = {
  info: { Icon: MdInfoOutline, label: "Info" },
  warning: { Icon: MdWarningAmber, label: "Heads up" },
  critical: { Icon: MdErrorOutline, label: "Important" },
  success: { Icon: MdCheckCircleOutline, label: "Good news" },
};

/** What to show for an announcement: its type, icon, label, clean title and message. */
export function describeAnnouncement(announcement) {
  const type = TYPES[announcement?.type] ? announcement.type : "warning";
  return {
    type,
    ...TYPES[type],
    // "⚠️ ERP ARC" → "ERP ARC": the type icon already says it
    title: (announcement?.title || "").replace(/^[\s\p{Extended_Pictographic}️‍]+/u, "").trim() || "Announcement",
    message: (announcement?.message || "").trim(),
  };
}
