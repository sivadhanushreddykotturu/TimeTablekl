// Course handouts through the backend: /fetch-handouts (the semester's courses) and /fetch-handout-detail (one handout, parsed).
// Handouts barely change, so both are kept on this device for a day; pull to refresh fetches them again.
import { API_CONFIG } from "../config/api.js";
import { erpCall, requireLogin } from "./erpCall.js";

const LIST_PREFIX = "handouts_list_v1:";
const DETAIL_PREFIX = "handout_v1:";
const TTL = 24 * 60 * 60 * 1000;

export const handoutsEnabled = () => Boolean(API_CONFIG.HANDOUTS_URL && API_CONFIG.HANDOUT_DETAIL_URL);

const period = () => `${localStorage.getItem("academicYear") || "2026-27"}:${localStorage.getItem("semester") || "odd"}`;

function read(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    return saved && Date.now() - saved.at < TTL ? saved.data : null;
  } catch {
    return null;
  }
}

function write(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* storage full or unavailable: it just isn't kept */
  }
}

export function clearHandouts() {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(LIST_PREFIX) || key.startsWith(DETAIL_PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    /* storage unavailable */
  }
}

/** The semester's courses: [{ course_code, course_name, offered_by, target_href, ... }] */
export async function loadHandouts({ force = false } = {}) {
  const { username } = requireLogin();
  const key = `${LIST_PREFIX}${username}:${period()}`;
  if (!force) {
    const saved = read(key);
    if (saved) return saved;
  }
  const data = await erpCall(API_CONFIG.HANDOUTS_URL);
  write(key, data.courses);
  return data.courses;
}

/** One course's parsed handout. */
export async function loadHandout(course, { force = false } = {}) {
  const { username } = requireLogin();
  const key = `${DETAIL_PREFIX}${username}:${period()}:${course.course_code}`;
  if (!force) {
    const saved = read(key);
    if (saved) return saved;
  }

  const fetchOne = (href) => erpCall(API_CONFIG.HANDOUT_DETAIL_URL, { target_href: href });
  let data;
  try {
    data = await fetchOne(course.target_href);
  } catch (err) {
    if (err.status !== 404) throw err;
    // the saved link went stale: ask the ERP for fresh ones and try once more
    const fresh = (await loadHandouts({ force: true })).find((c) => c.course_code === course.course_code);
    if (!fresh) throw err;
    data = await fetchOne(fresh.target_href);
  }
  write(key, data.handout);
  return data.handout;
}
