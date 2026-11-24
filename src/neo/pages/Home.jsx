import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MdLogin, MdSync } from "react-icons/md";
import NeoShell, { NeoModal } from "../Shell.jsx";
import { ClassTimerReadout, ClassProgressBar } from "../components/ClassTimer.jsx";
import AnnouncementBanner from "../components/AnnouncementBanner.jsx";
import SmartStrip from "../components/SmartStrip.jsx";
import TimetableChangesModal from "../components/TimetableChangesModal.jsx";
import Toast from "../../components/Toast.jsx";

import { getCredentials } from "../../../utils/storage.js";
import { trackEvent } from "../../utils/analytics";
import { useNowTick } from "../../hooks/useNowTick";
import { useTimetable } from "../../hooks/useTimetable";
import { useEventBackground } from "../../hooks/useEventBackground";
import { useSync } from "../../contexts/SyncContext.jsx";
import { formatTimeStr } from "../../utils/slotTimes";
import {
  getDayState,
  hasClasses,
  subjectHue,
  formatRange,
  formatMeta,
  formatDuration,
  getTimeFormat,
} from "../../utils/schedule";

/**
 * The one thing the hero shows, in priority order:
 * the class in session → the next class today → the first class of the next
 * class day → nothing scheduled at all.
 */
function pickFeature(state) {
  if (state.current) {
    return { kind: "live", block: state.current, then: state.next };
  }
  if (state.next) {
    return { kind: "next", block: state.next, startsIn: state.next.startMin - state.nowMin };
  }
  if (state.ahead) {
    return { kind: "ahead", block: state.ahead.blocks[0], ahead: state.ahead };
  }
  return { kind: "empty" };
}

function ClassCard({ block, live = false, done = false, cardRef }) {
  const format = getTimeFormat();
  return (
    <article
      ref={cardRef}
      className={`np-classcard${live ? " is-live" : ""}${done ? " is-done" : ""}`}
      style={{ "--hue": subjectHue(block.code) }}
    >
      <div className="np-classcard__time">
        <span>
          {formatTimeStr(block.start, format)} – {formatTimeStr(block.end, format)}
        </span>
        {live && <span className="np-classcard__tag">Now</span>}
        {done && <span className="np-classcard__tag np-classcard__tag--done">Done</span>}
      </div>
      <div className="np-classcard__name">{block.title}</div>
      <div className="np-classcard__meta">{formatMeta(block)}</div>
      {live && <ClassProgressBar startTimeMs={block.startTimeMs} endTimeMs={block.endTimeMs} />}
    </article>
  );
}

export default function NeoHome() {
  const navigate = useNavigate();
  const { timetable, autoSyncing, changes, clearChanges, refresh } = useTimetable("home_page");
  const nowTick = useNowTick();
  const { isSyncing } = useSync();
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [syncing, setSyncing] = useState(false);
  // the event image is the last thing to load: only once nothing is syncing
  const eventBg = useEventBackground(syncing || autoSyncing || isSyncing);
  const focusCardRef = useRef(null);

  // Recomputed every 30s and when the app returns to the foreground.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const state = useMemo(() => getDayState(timetable), [timetable, nowTick]);
  const feature = pickFeature(state);
  const loaded = useMemo(() => hasClasses(timetable), [timetable]);
  const format = getTimeFormat();

  useEffect(() => {
    trackEvent("home_page_viewed", {
      has_timetable: Object.keys(timetable).length > 0,
      has_current_class: !!state.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the class that matters at the start of the Today rail.
  const focusKey = (state.current || state.next)?.startSlot;
  useEffect(() => {
    const card = focusCardRef.current;
    const rail = card?.parentElement;
    if (!card || !rail) return;
    const inset = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
    rail.scrollTo({ left: card.offsetLeft - rail.offsetLeft - inset, behavior: "smooth" });
  }, [focusKey]);

  const handleRefresh = async () => {
    try {
      await refresh();
    } catch (error) {
      setToast({
        show: true,
        message: error.message || "Failed to sync timetable.",
        type: "error",
      });
      throw error;
    }
  };

  const handleHeroSync = async () => {
    setSyncing(true);
    try {
      await handleRefresh();
    } catch {
      /* toast already shown */
    } finally {
      setSyncing(false);
    }
  };

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const remaining = state.blocks.filter((b) => b.status !== "done").length;
  const { block } = feature;

  return (
    <NeoShell onRefresh={handleRefresh} autoSyncing={autoSyncing}>
      <section
        className={`np-hero${block ? "" : " np-hero--idle"}${eventBg ? ` np-hero--event${eventBg.glow ? " np-hero--event-glow" : ""}` : ""}`}
        style={block ? { "--hue": subjectHue(block.code) } : undefined}
        aria-live="polite"
      >
        <div className="np-hero__art" aria-hidden="true">
          {eventBg && (
            <div
              className={`np-hero__event${eventBg.fade === 0 ? " np-hero__event--instant" : ""}`}
              style={{
                "--event-img": `url("${eventBg.url}")`,
                "--event-strength": eventBg.strength,
                "--event-focus": eventBg.focus,
                "--event-fade": `${eventBg.fade ?? 1600}ms`,
                ...(eventBg.accent ? { "--event-accent": eventBg.accent } : null),
              }}
            />
          )}
        </div>

        <div className="np-hero__status">
          {feature.kind === "live" && (
            <>
              <span className="np-hero__badge np-hero__badge--live">
                <span className="np-hero__pulse" /> Now
              </span>
              <ClassTimerReadout startTimeMs={block.startTimeMs} endTimeMs={block.endTimeMs} />
            </>
          )}
          {feature.kind === "next" && (
            <>
              <span className="np-hero__badge">Up next</span>
              <span>in {formatDuration(feature.startsIn)}</span>
            </>
          )}
          {feature.kind === "ahead" && (
            <>
              <span className="np-hero__badge">{feature.ahead.label}</span>
              <span>
                {state.blocks.length > 0 ? "Done for today" : "No classes today"}
              </span>
            </>
          )}
          {feature.kind === "empty" && <span className="np-hero__badge">{todayLabel}</span>}
        </div>

        {block ? (
          <>
            <h1 className="np-hero__title">{block.title}</h1>
            <p className="np-hero__meta">
              <b>{formatRange(block, format)}</b>
              {formatMeta(block) && ` · ${formatMeta(block)}`}
            </p>
          </>
        ) : (
          <>
            <h1 className="np-hero__title">
              {loaded ? "Nothing scheduled" : "No timetable yet"}
            </h1>
            <p className="np-hero__meta">
              {loaded
                ? "Your week is clear."
                : getCredentials()
                ? "Sync to pull your classes from ERP."
                : "Log in with your KL ERP account to load your classes."}
            </p>
          </>
        )}

        {feature.kind === "live" && (
          <>
            <ClassProgressBar startTimeMs={block.startTimeMs} endTimeMs={block.endTimeMs} />
            <div className="np-hero__then">
              <span>Then</span>
              {feature.then ? (
                <b>
                  {formatTimeStr(feature.then.start, format)} · {feature.then.title}
                </b>
              ) : (
                <b>You're done for the day</b>
              )}
            </div>
          </>
        )}

        <div className="np-hero__foot">
          {!loaded && (
            <div className="np-hero__actions">
              {getCredentials() ? (
                <button className="np-pill" onClick={handleHeroSync} disabled={syncing || autoSyncing}>
                  <MdSync size={19} className={syncing || autoSyncing ? "np-spin" : undefined} />
                  {syncing || autoSyncing ? "Syncing" : "Sync now"}
                </button>
              ) : (
                <button className="np-pill" onClick={() => navigate("/")}>
                  <MdLogin size={19} /> Log in
                </button>
              )}
            </div>
          )}

          {state.blocks.length > 1 && (
            <div
              className="np-daydots"
              role="img"
              aria-label={`${state.blocks.length - remaining} of ${state.blocks.length} classes done today`}
            >
              {state.blocks.map((b) => (
                <i
                  key={b.startSlot}
                  className={b.status === "live" ? "is-live" : b.status === "done" ? "is-done" : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <AnnouncementBanner />

      <SmartStrip state={state} />

      {state.blocks.length > 0 && (
        <section className="np-shelf">
          <div className="np-shelf__head">
            <h2 className="np-shelf__title">Today</h2>
            <span className="np-shelf__meta">
              {remaining === 0
                ? `${state.blocks.length} done`
                : `${remaining} of ${state.blocks.length} left`}
            </span>
          </div>
          <div className="np-rail">
            {state.blocks.map((b) => (
              <ClassCard
                key={b.startSlot}
                block={b}
                live={b.status === "live"}
                done={b.status === "done"}
                cardRef={b.startSlot === focusKey ? focusCardRef : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {state.ahead && (
        <section className="np-shelf">
          <div className="np-shelf__head">
            <h2 className="np-shelf__title">{state.ahead.label}</h2>
            <Link to="/timetable" className="np-shelf__meta">
              {state.ahead.blocks.length} {state.ahead.blocks.length === 1 ? "class" : "classes"} ·
              from {formatTimeStr(state.ahead.blocks[0].start, format)}
            </Link>
          </div>
          <div className="np-rail">
            {state.ahead.blocks.map((b) => (
              <ClassCard key={b.startSlot} block={b} />
            ))}
          </div>
        </section>
      )}

      {/* what the last sync changed */}
      <TimetableChangesModal changes={changes} onClose={clearChanges} />

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
    </NeoShell>
  );
}
