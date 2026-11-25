import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { MdChevronRight, MdExpandMore } from "react-icons/md";
import NeoShell, { NeoModal, NeoLoading, NeoSkeleton } from "../Shell.jsx";
import GuestAuthModal from "../../components/GuestAuthModal.jsx";
import { getCredentials } from "../../../utils/storage.js";
import { clearInternals, formatMark, loadComponent, loadInternals, readComponent, totalsFor } from "../../utils/internals.js";

const SMALL_WORDS = new Set(["and", "of", "the", "in", "for", "to", "with", "a", "an", "on"]);

/** "DATA STRUCTURES AND ALGORITHMS" → "Data Structures and Algorithms" */
function titleCase(text) {
  return (text || "")
    .split(/\s+/)
    .map((raw, index) => {
      if (raw.startsWith("(")) return raw; // short codes in brackets, like (CNAD), stay as ERP wrote them
      const word = raw.toLowerCase();
      return index > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

const KIND_LETTER = { summative: "S", formative: "F" };
const keyOf = (course, component) => `${course.course_code}|${component.name}`;

/** One line under a component's name. */
function describe(entry) {
  if (!entry || entry.status === "loading") return "Loading…";
  if (entry.status === "error") return "Couldn't load · tap to retry";
  const r = entry.reading;
  if (r.state === "unpublished") return "Not published yet";
  if (r.state !== "ok") return "Not fully calculated yet";
  return `${formatMark(r.total)} of ${formatMark(r.max)} · weight ${formatMark(r.weight)}`;
}

/** The marks / weight / weighted rows, leaving out any value ERP has not filled in. */
function summaryRows(r) {
  const known = (n) => n !== null && n !== undefined && n >= 0;
  const rows = [];
  if (known(r.total) && known(r.max)) rows.push({ label: "Marks", value: `${formatMark(r.total)} / ${formatMark(r.max)}` });
  if (known(r.weight)) rows.push({ label: "Weight", value: formatMark(r.weight) });
  if (known(r.weighted)) rows.push({ label: "Weighted marks", value: formatMark(r.weighted) });
  return rows;
}

export default function NeoInternals() {
  const location = useLocation();
  const friend = location.state?.friendCredentials || null;
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState({});
  const [data, setData] = useState({});
  const [detail, setDetail] = useState(null);
  const [showGuestModal, setShowGuestModal] = useState(() => !friend && !getCredentials());
  const started = useRef(new Set());

  const fetchList = useCallback(async (force = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await loadInternals({ force, friend });
      setSession(next);
    } catch (err) {
      setSession(null);
      setError(err);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend?.username, friend?.semester, friend?.academicYear]);

  useEffect(() => {
    if (friend || getCredentials()) fetchList(false);
  }, [fetchList, friend]);

  const refresh = async () => {
    if (!friend && !getCredentials()) {
      setShowGuestModal(true);
      return;
    }
    clearInternals();
    started.current = new Set();
    setData({});
    setOpen({});
    await fetchList(true);
  };

  const fetchOne = async (course, component) => {
    const key = keyOf(course, component);
    setData((prev) => ({ ...prev, [key]: { status: "loading" } }));
    try {
      const res = await loadComponent(course.course_code, component.name, friend);
      setData((prev) => ({ ...prev, [key]: { status: "done", reading: readComponent(res) } }));
    } catch (err) {
      started.current.delete(key);
      setData((prev) => ({ ...prev, [key]: { status: "error", message: err.message } }));
    }
  };

  /** Opens a course and reads its components two at a time (ERP rate-limits logins). */
  const toggleCourse = async (course) => {
    const opening = !open[course.course_code];
    setOpen((prev) => ({ ...prev, [course.course_code]: opening }));
    if (!opening) return;

    const queue = course.components.filter((component) => {
      const key = keyOf(course, component);
      if (started.current.has(key)) return false;
      started.current.add(key);
      return true;
    });

    const worker = async () => {
      while (queue.length) {
        await fetchOne(course, queue.shift());
      }
    };
    await Promise.all([worker(), worker()]);
  };

  const openDetail = (course, component) => {
    const entry = data[keyOf(course, component)];
    if (entry?.status === "error") {
      started.current.add(keyOf(course, component));
      fetchOne(course, component);
      return;
    }
    if (entry?.status === "done") setDetail({ course, component, reading: entry.reading });
  };

  const courses = session?.courses || [];
  const detailReading = detail?.reading;

  return (
    <NeoShell onRefresh={refresh}>
      <div className="np-pagehead">
        <div className="np-pagehead__row">
          <h1 className="np-pagehead__title">{friend ? `${friend.name}'s internals` : "Internals"}</h1>
        </div>
        {courses.length > 0 && (
          <p className="np-pagehead__sub">Tap a subject to see its marks</p>
        )}
      </div>

      {isLoading ? (
        <NeoSkeleton variant="card" count={4} text="Fetching your internals…" />
      ) : error ? (
        error.code === "NO_LOGIN" || error.code === "BAD_LOGIN" ? (
          <div className="np-empty">
            <h2 className="np-empty__title">{friend ? "Couldn't log in" : "See your internals"}</h2>
            <p className="np-empty__text">{error.message}</p>
            {!friend && (
              <button type="button" className="np-btn" onClick={() => setShowGuestModal(true)}>Log in</button>
            )}
          </div>
        ) : error.code === "EMPTY" ? (
          <div className="np-empty">
            <h2 className="np-empty__title">No internals yet</h2>
            <p className="np-empty__text">{error.message}</p>
          </div>
        ) : (
          <div className="np-empty">
            <h2 className="np-empty__title">Couldn't load internals</h2>
            <p className="np-empty__text">{error.message}</p>
            <button type="button" className="np-btn" onClick={() => fetchList(true)}>Try again</button>
          </div>
        )
      ) : courses.length === 0 ? (
        <div className="np-empty">
          <h2 className="np-empty__title">No internals yet</h2>
          <p className="np-empty__text">Nothing came back from ERP for this semester.</p>
        </div>
      ) : (
        courses.map((course) => {
          const isOpen = Boolean(open[course.course_code]);
          const readings = course.components.map((component) => {
            const entry = data[keyOf(course, component)];
            return entry?.status === "done" ? entry.reading : null;
          });
          const totals = totalsFor(readings);
          return (
            <article key={course.course_code} className="np-att">
              <button
                type="button"
                className="np-att__section"
                style={{ padding: "18px 14px 16px 18px" }}
                aria-expanded={isOpen}
                onClick={() => toggleCourse(course)}
              >
                <span className="np-att__section-info">
                  <span className="np-att__name">{titleCase(course.course_name)}</span>
                  <span className="np-att__code">
                    {course.course_code} · {course.components.length} components
                  </span>
                </span>
                {isOpen && totals.outOf > 0 ? (
                  <span className="np-att__nums">
                    <span className="np-att__pct">{formatMark(totals.got)}</span>
                    <span className="np-att__hint">of {formatMark(totals.outOf)} so far</span>
                  </span>
                ) : null}
                <MdExpandMore
                  className="np-att__chev"
                  size={22}
                  aria-hidden="true"
                  style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
                />
              </button>

              {isOpen &&
                course.components.map((component) => {
                  const entry = data[keyOf(course, component)];
                  const reading = entry?.status === "done" ? entry.reading : null;
                  const showWeighted = reading?.state === "ok" && reading.weighted !== null && reading.weighted >= 0;
                  return (
                    <button
                      key={component.name}
                      type="button"
                      className="np-att__section"
                      onClick={() => openDetail(course, component)}
                    >
                      <span className="np-att__ltps">{KIND_LETTER[component.kind] || "•"}</span>
                      <span className="np-att__section-info">
                        <span className="np-att__section-name">{component.name}</span>
                        <span className="np-att__detail">{describe(entry)}</span>
                      </span>
                      {showWeighted && (
                        <span className="np-att__nums">
                          <span className="np-att__pct">{formatMark(reading.weighted)}</span>
                          <span className="np-att__hint">of {formatMark(reading.weight)}</span>
                        </span>
                      )}
                      <MdChevronRight className="np-att__chev" size={20} aria-hidden="true" />
                    </button>
                  );
                })}
            </article>
          );
        })
      )}

      <NeoModal open={Boolean(detail)} title={detail?.component.name || "Marks"} onClose={() => setDetail(null)}>
        {detail && (
          <>
            <p className="np-note" style={{ marginBottom: 14 }}>
              {titleCase(detail.course.course_name)} ·{" "}
              {detail.component.kind === "summative" ? "Exam" : detail.component.kind === "formative" ? "Continuous evaluation" : "Other"}
            </p>

            {!detailReading ? (
              <NeoLoading text="Fetching marks…" />
            ) : detailReading.state === "unpublished" ? (
              <p className="np-note">Not published yet.</p>
            ) : (
              <>
                {detailReading.state !== "ok" && (
                  <p className="np-note" style={{ marginBottom: 14 }}>
                    ERP hasn't fully calculated this one yet, so these numbers aren't final. Open it in ERP once it's complete.
                  </p>
                )}

                {summaryRows(detailReading).length > 0 && (
                  <div className="np-reglist">
                    {summaryRows(detailReading).map((row) => (
                      <div key={row.label} className="np-reglist__row">
                        <span>{row.label}</span>
                        <b>{row.value}</b>
                      </div>
                    ))}
                  </div>
                )}

                {detailReading.parts.length > 0 && (
                  <>
                    <h3 className="np-shelf__title" style={{ margin: "20px 0 8px" }}>
                      {detail.component.kind === "formative" ? "By course outcome" : "By question"}
                    </h3>
                    <div className="np-reglist">
                      {detailReading.parts.map((part) => (
                        <div key={part.label} className="np-reglist__row">
                          <span>{part.label}</span>
                          <b>{formatMark(part.value)}</b>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </NeoModal>

      <GuestAuthModal
        isOpen={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        pageType="internals"
        onSuccess={async () => {
          setShowGuestModal(false);
          await fetchList(true);
        }}
      />
    </NeoShell>
  );
}
