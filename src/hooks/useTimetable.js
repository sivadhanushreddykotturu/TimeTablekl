import { useCallback, useEffect, useState } from "react";
import { syncTimetable } from "../../utils/syncTimetable.js";
import { trackEvent } from "../utils/analytics";

function readStoredTimetable() {
  try {
    return JSON.parse(localStorage.getItem("timetable") || "{}") || {};
  } catch {
    return {};
  }
}

const PENDING_KEY = "timetable_pending_changes";

/** Changes found by a sync that the user has not seen yet (survives a screen change or reload). */
function readPendingChanges() {
  try {
    const list = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Slot-level diff between two timetables: [{ day, slot, oldClass, newClass }]. */
export function getTimetableChanges(oldTimetable = {}, newTimetable = {}) {
  const changes = [];
  const days = new Set([...Object.keys(oldTimetable || {}), ...Object.keys(newTimetable || {})]);

  days.forEach((day) => {
    const oldSlots = oldTimetable?.[day] || {};
    const newSlots = newTimetable?.[day] || {};
    const slots = Array.from(new Set([...Object.keys(oldSlots), ...Object.keys(newSlots)]))
      .sort((a, b) => Number(a) - Number(b));

    slots.forEach((slot) => {
      const oldClass = oldSlots[slot] || "-";
      const newClass = newSlots[slot] || "-";
      if (oldClass !== newClass) changes.push({ day, slot, oldClass, newClass });
    });
  });

  return changes;
}

/**
 * The stored timetable plus its sync plumbing, shared by Today and Week:
 *  - syncs silently once per day on first open
 *  - refresh() syncs on demand and throws on failure (the caller shows the error)
 *  - changes lists what the last sync changed, until clearChanges()
 */
export function useTimetable(syncLocation) {
  const [timetable, setTimetable] = useState(readStoredTimetable);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [changes, setChanges] = useState(readPendingChanges);

  // new changes replace the unseen ones; a sync with no changes leaves them be
  const showChanges = useCallback((list) => {
    if (!list.length) return;
    setChanges(list);
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(list));
    } catch {
      /* storage full: the dialog still shows this time */
    }
  }, []);

  const sync = useCallback(async (method) => {
    const previous = readStoredTimetable();
    const next = await syncTimetable();
    localStorage.setItem("timetable_last_sync", new Date().toDateString());
    trackEvent("timetable_synced", {
      sync_location: syncLocation,
      day_count: Object.keys(next).length,
      sync_method: method,
    });
    return { next, changes: getTimetableChanges(previous, next) };
  }, [syncLocation]);

  useEffect(() => {
    if (localStorage.getItem("timetable_last_sync") === new Date().toDateString()) return;

    let cancelled = false;
    setAutoSyncing(true);
    sync("auto_daily")
      .then((result) => {
        if (cancelled) return;
        setTimetable(result.next);
        showChanges(result.changes);
      })
      .catch(() => {
        // Silent: the manual sync button is right there.
      })
      .finally(() => {
        if (!cancelled) setAutoSyncing(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async () => {
    const result = await sync("direct");
    setTimetable(result.next);
    showChanges(result.changes);
  }, [sync, showChanges]);

  const reload = useCallback(() => setTimetable(readStoredTimetable()), []);
  const clearChanges = useCallback(() => {
    setChanges([]);
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { timetable, autoSyncing, changes, clearChanges, refresh, reload };
}
