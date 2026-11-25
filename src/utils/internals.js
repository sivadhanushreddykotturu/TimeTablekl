// Course internals from the ERP, through the backend's /fetch-internals and /fetch-internal-component.
//
// The one rule: every target_href only works in the ERP login session that produced it. So this keeps its own
// session (cookies + course list) per person, sends those cookies on every call, and throws the links away
// whenever the session changes. It never shares cookies with the app's other endpoints.
//
// Every call takes an optional `friend` ({ username, password, semester, academicYear }) to read a friend's
// internals instead of your own. A friend's session is kept apart from yours.
import axios from "axios";
import { API_CONFIG, SEMESTER_MAP, getAcademicYearCode } from "../config/api.js";
import { getCredentials } from "../../utils/storage.js";

const SESSION_PREFIX = "internals_session_v2:";
const LIST_TTL = 30 * 60 * 1000;

export const internalsEnabled = () => Boolean(API_CONFIG.INTERNALS_URL && API_CONFIG.INTERNAL_COMPONENT_URL);

/** Results by `${PHPSESSID}|course|component`; links from another session are useless, so a new session starts empty. */
const results = new Map();

const needsLogin = () => {
  const error = new Error("Log in with your KL ERP account to see your internals.");
  error.code = "NO_LOGIN";
  return error;
};

/** Who we are reading: your own saved login and semester, or a friend's. */
function whose(friend) {
  if (friend) {
    return {
      creds: { username: friend.username, password: friend.password },
      semester: SEMESTER_MAP[friend.semester] || "1",
      academic_year: getAcademicYearCode(friend.academicYear || "2026-27"),
    };
  }
  const creds = getCredentials();
  if (!creds) throw needsLogin();
  return {
    creds,
    semester: SEMESTER_MAP[localStorage.getItem("semester") || "odd"] || "1",
    academic_year: getAcademicYearCode(localStorage.getItem("academicYear") || "2026-27"),
  };
}

const storeKey = (who) => `${SESSION_PREFIX}${who.creds.username}`;
const periodKey = (who) => `${who.creds.username}|${who.academic_year}|${who.semester}`;

function readSession(who) {
  try {
    return JSON.parse(sessionStorage.getItem(storeKey(who)) || "null");
  } catch {
    return null;
  }
}

function writeSession(who, session) {
  try {
    sessionStorage.setItem(storeKey(who), JSON.stringify(session));
  } catch {
    /* storage unavailable: the session just lives for this call chain */
  }
}

/** Forgets every stored internals session (logout, new account, refresh). */
export function clearInternals() {
  results.clear();
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(SESSION_PREFIX))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    /* nothing to clear */
  }
}

const cookieFields = (c = {}) => ({
  php_sess_id: c.PHPSESSID || "",
  csrf_cookie: c._csrf || "",
  device_id: c.kl_erp_device_id || "",
  server_id: c.SERVERID || "erp1",
});

async function post(url, fields) {
  try {
    const res = await axios.post(url, new URLSearchParams(fields));
    return res.data;
  } catch (error) {
    const status = error.response?.status || 0;
    const detail = String(error.response?.data?.detail || error.message || "");
    const wrapped = new Error(detail || "Request failed");
    wrapped.status = status;
    wrapped.detail = detail;
    throw wrapped;
  }
}

const friendly = (error, friend) => {
  if (error.code) return error;
  if (error.status === 401) {
    const wrapped = new Error(
      friend
        ? "ERP did not accept this friend's ID or password. Edit them in Docs."
        : "ERP did not accept your ID or password. Check them in Profile."
    );
    wrapped.code = "BAD_LOGIN";
    return wrapped;
  }
  if (error.status === 429 || /429/.test(error.detail || "")) {
    return new Error("ERP is busy right now. Wait a minute and try again.");
  }
  if (error.status === 404) return Object.assign(new Error("No internals are listed for this semester yet."), { code: "EMPTY" });
  return new Error("Couldn't reach ERP. Please try again.");
};

const listsInFlight = new Map();

/** Courses for the semester. Reuses the stored list for a while; `force` logs a fresh list in. */
export function loadInternals({ force = false, friend = null } = {}) {
  const who = whose(friend);
  // two callers at once (a re-render, a double tap) share one call: each call without cookies is an ERP login
  const key = storeKey(who);
  if (!listsInFlight.has(key)) {
    listsInFlight.set(
      key,
      fetchInternals(who, force, friend).finally(() => listsInFlight.delete(key))
    );
  }
  return listsInFlight.get(key);
}

async function fetchInternals(who, force, friend) {
  const key = periodKey(who);
  const saved = readSession(who);

  if (!force && saved?.key === key && Date.now() - saved.fetchedAt < LIST_TTL && saved.courses?.length) {
    return saved;
  }

  try {
    const res = await post(API_CONFIG.INTERNALS_URL, {
      username: who.creds.username,
      password: who.creds.password,
      academic_year: who.academic_year,
      semester: who.semester,
      ...cookieFields(saved?.key === key ? saved.cookies : {}),
    });
    if (saved?.cookies?.PHPSESSID !== res.cookies?.PHPSESSID) results.clear();
    const session = { key, cookies: res.cookies || {}, courses: res.courses || [], fetchedAt: Date.now() };
    writeSession(who, session);
    return session;
  } catch (error) {
    throw friendly(error, friend);
  }
}

const isLinkExpired = (error) =>
  error.status === 404 || (error.status >= 500 && /302|Temporary server error|redirect/i.test(error.detail || ""));

/**
 * The raw marks table for one component. If the link has expired, refreshes the course list once,
 * finds the same component again by (course, name) and retries once. Never loops.
 */
export async function loadComponent(courseCode, componentName, friend = null) {
  const who = whose(friend);

  const find = (session) =>
    session.courses.find((c) => c.course_code === courseCode)?.components.find((c) => c.name === componentName);

  const saved = readSession(who);
  let session = saved?.key === periodKey(who) ? saved : await loadInternals({ friend });
  const cacheKey = () => `${session.cookies.PHPSESSID}|${courseCode}|${componentName}`;
  if (results.has(cacheKey())) return results.get(cacheKey());

  const call = async (current) => {
    const component = find(current);
    if (!component) throw Object.assign(new Error("This component is no longer listed."), { code: "GONE" });
    const res = await post(API_CONFIG.INTERNAL_COMPONENT_URL, {
      username: who.creds.username,
      password: who.creds.password,
      target_href: component.target_href,
      ...cookieFields(current.cookies),
    });
    if (res.cookies) {
      session = { ...current, cookies: res.cookies };
      writeSession(who, session);
    }
    return res;
  };

  let res;
  try {
    res = await call(session);
  } catch (error) {
    if (!isLinkExpired(error)) throw friendly(error, friend);
    try {
      session = await loadInternals({ force: true, friend });
      res = await call(session);
    } catch (retryError) {
      throw friendly(retryError, friend);
    }
  }

  results.set(cacheKey(), res);
  return res;
}

// ---------- reading what ERP returned ----------

const IDENTITY = new Set(["Sno", "Coursecode", "Coursedesc", "Remarks", "Student Uniid"]);
const SUMMARY = new Set(["Max Marks", "Weight", "Total Marks", "Weighted Marks"]);

const toNumber = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

/** ERP's own markers: -1, -2 and A all mean "nothing usable here yet" (A is how ERP shows a value it hasn't calculated, not an absence). */
const marker = (value) => {
  const text = String(value ?? "").trim();
  const n = toNumber(text);
  if (text === "" || n === null || n < 0) return "none";
  return null;
};

export const formatMark = (value) => {
  const kind = marker(value);
  if (kind === "none") return "–";
  const n = toNumber(value);
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
};

/**
 * Turns one /fetch-internal-component response into what the screen needs:
 * { state: "unpublished" | "pending" | "ok", parts: [{label, value}], max, weight, total, weighted }
 */
export function readComponent(res) {
  if (!res?.published || !res.rows?.length) return { state: "unpublished", parts: [] };

  const row = res.rows[0].by_column || {};
  const parts = (res.columns || [])
    .filter((name) => !IDENTITY.has(name) && !SUMMARY.has(name))
    .map((name) => ({ label: name, value: row[name], kind: marker(row[name]) }));

  const max = toNumber(row["Max Marks"]);
  const weight = toNumber(row["Weight"]);
  const total = toNumber(row["Total Marks"]);
  const weighted = toNumber(row["Weighted Marks"]);

  let state = "ok";
  if (marker(row["Total Marks"]) !== null || max === null || max < 0) state = "pending";
  // outcome marks are filled in but ERP still shows a 0 total: it just hasn't added them up yet
  else if (total === 0 && weighted === 0 && parts.some((p) => p.kind === null && toNumber(p.value) > 0)) state = "pending";

  return { state, parts, max, weight, total, weighted };
}

/** Adds up what is known so far across read components (the backend never does this). */
export function totalsFor(readings) {
  let got = 0;
  let outOf = 0;
  readings.forEach((r) => {
    if (r?.state !== "ok" || !(r.weight > 0) || r.weighted === null || r.weighted < 0) return;
    got += r.weighted;
    outOf += r.weight;
  });
  return { got: Math.round(got * 100) / 100, outOf: Math.round(outOf * 100) / 100 };
}
