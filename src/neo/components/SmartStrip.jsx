import React, { useMemo } from "react";
import {
  MdCoffee,
  MdDirectionsWalk,
  MdEditNote,
  MdViewDay,
  MdCelebration,
} from "react-icons/md";
import { buildInsights } from "../../utils/insights.js";

const ICONS = {
  free: MdCoffee,
  room: MdDirectionsWalk,
  exam: MdEditNote,
  day: MdViewDay,
  done: MdCelebration,
};

/**
 * A few lines under the Today header that read the day for you: how long you are
 * free, room changes, exams close by and the shape of the day.
 * Recomputed whenever the schedule state changes (every 30s tick).
 */
export default function SmartStrip({ state }) {
  const insights = useMemo(
    () => buildInsights(state),
    // state is rebuilt on every tick, which is exactly when these should refresh
    [state]
  );

  if (insights.length === 0) return null;

  return (
    <section className="np-smart" aria-label="Today at a glance">
      {insights.map((item) => {
        const Icon = ICONS[item.icon] || MdViewDay;
        return (
          <div key={item.id} className={`np-smart__item np-smart__item--${item.tone}`}>
            <span className="np-smart__icon" aria-hidden="true">
              <Icon size={18} />
            </span>
            <div className="np-smart__body">
              <div className="np-smart__title">{item.title}</div>
              {item.text && <div className="np-smart__text">{item.text}</div>}
            </div>
          </div>
        );
      })}
    </section>
  );
}
