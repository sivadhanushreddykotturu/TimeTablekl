import React, { useEffect, useMemo, useState } from "react";

/**
 * AttendanceCalculator — type your numbers, get the answer as you type.
 *
 * Two modes, both using the ERP's own maths:
 *   One component   attended ÷ (conducted − TCBR), plus how many classes you
 *                   can miss (or must attend) for a target percentage.
 *   Whole subject   weighted average across Lecture/Tutorial/Practical/Skill.
 */

// How much each component counts towards a subject's overall percentage.
const WEIGHTS = { L: 100, T: 100, P: 50, S: 25 };
const COMPONENTS = [
  { type: "L", label: "Lecture" },
  { type: "T", label: "Tutorial" },
  { type: "P", label: "Practical" },
  { type: "S", label: "Skill" },
];

const emptyRows = () =>
  Object.fromEntries(COMPONENTS.map(({ type }) => [type, { attended: "", conducted: "", tcbr: "" }]));

const digits = (value) => value.replace(/[^0-9]/g, "");
const toInt = (value) => parseInt(value || "0", 10);

function storedTarget() {
  const saved = parseFloat(localStorage.getItem("attendanceTargetPercentage"));
  return Number.isFinite(saved) && saved > 0 && saved <= 100 ? String(saved) : "85";
}

/** Result for one component, or { error } / null when there is nothing to show yet. */
function solveSingle({ attended, conducted, tcbr, target }) {
  if (attended === "" || conducted === "") return null;
  const a = toInt(attended);
  const c = toInt(conducted);
  const t = toInt(tcbr);
  if (c <= 0) return { error: "Conducted classes must be more than 0." };
  if (a > c) return { error: "Attended can't be more than conducted." };

  const effective = Math.max(1, c - t);
  const percent = (a / effective) * 100;
  const goal = parseFloat(target);
  if (!Number.isFinite(goal) || goal <= 0 || goal > 100) {
    return { percent, note: "Set a target between 1 and 100 to plan bunks." };
  }

  if (percent >= goal) {
    const canMiss = Math.max(0, Math.floor((100 * a - goal * effective) / goal));
    return {
      percent,
      safe: true,
      note: canMiss > 0 ? `You can miss ${canMiss} more and stay at ${goal}%.` : `You're at the limit: attend the next class to stay at ${goal}%.`,
    };
  }
  if (goal >= 100) return { percent, safe: false, note: "100% is no longer reachable." };
  const needed = Math.ceil((goal * effective - 100 * a) / (100 - goal));
  return { percent, safe: false, note: `Attend the next ${needed} in a row to reach ${goal}%.` };
}

/** Weighted average across the components that have numbers. */
function solveWeighted(rows) {
  let attendedSum = 0;
  let conductedSum = 0;
  let used = 0;

  for (const { type, label } of COMPONENTS) {
    const row = rows[type];
    if (row.attended === "" && row.conducted === "") continue;
    const a = toInt(row.attended);
    const c = toInt(row.conducted);
    const t = toInt(row.tcbr);
    if (c <= 0) return { error: `${label}: conducted must be more than 0.` };
    if (a + t > c) return { error: `${label}: attended + TCBR can't be more than conducted.` };
    attendedSum += a * WEIGHTS[type];
    conductedSum += Math.max(0, c - t) * WEIGHTS[type];
    used++;
  }

  if (used === 0 || conductedSum <= 0) return null;
  // the ERP rounds a subject's percentage up
  return { percent: Math.ceil(Math.min(100, (attendedSum / conductedSum) * 100)), used };
}

function NumberField({ id, label, value, onChange, placeholder }) {
  return (
    <div className="np-field">
      <div className="np-field__head">
        <label className="np-field__label" htmlFor={id}>{label}</label>
      </div>
      <input
        id={id}
        className="np-field__input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default function AttendanceCalculator({ initialComponents = null }) {
  const [mode, setMode] = useState(initialComponents?.length ? "subject" : "single");
  const [single, setSingle] = useState({ attended: "", conducted: "", tcbr: "", target: storedTarget() });
  const [rows, setRows] = useState(emptyRows);

  // opened from a subject card: start with that subject's real numbers
  useEffect(() => {
    if (!initialComponents?.length) return;
    const next = emptyRows();
    initialComponents.forEach((item) => {
      if (!next[item.type]) return;
      next[item.type] = {
        attended: String(item.attended ?? ""),
        conducted: String(item.conducted ?? ""),
        tcbr: toInt(String(item.tcbr ?? "")) > 0 ? String(item.tcbr) : "",
      };
    });
    setRows(next);
    setMode("subject");
  }, [initialComponents]);

  const singleResult = useMemo(() => solveSingle(single), [single]);
  const weighted = useMemo(() => solveWeighted(rows), [rows]);
  const result = mode === "single" ? singleResult : weighted;

  const setSingleField = (field) => (value) =>
    setSingle((prev) => ({ ...prev, [field]: field === "target" ? value.replace(/[^0-9.]/g, "") : digits(value) }));

  const setRowField = (type, field, value) =>
    setRows((prev) => ({ ...prev, [type]: { ...prev[type], [field]: digits(value) } }));

  const clear = () => {
    setSingle((prev) => ({ attended: "", conducted: "", tcbr: "", target: prev.target }));
    setRows(emptyRows());
  };

  const hasInput =
    mode === "single"
      ? Boolean(single.attended || single.conducted || single.tcbr)
      : COMPONENTS.some(({ type }) => rows[type].attended || rows[type].conducted || rows[type].tcbr);

  return (
    <div className="np-calc">
      <div className="np-seg" role="tablist" aria-label="Calculator mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "single"}
          className={`np-seg__btn${mode === "single" ? " is-active" : ""}`}
          onClick={() => setMode("single")}
        >
          One component
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "subject"}
          className={`np-seg__btn${mode === "subject" ? " is-active" : ""}`}
          onClick={() => setMode("subject")}
        >
          Whole subject
        </button>
      </div>

      {/* the answer, live */}
      <div
        className={`np-calc__result${result?.error ? " is-error" : ""}`}
        aria-live="polite"
      >
        {!result ? (
          <p className="np-calc__hint">
            {mode === "single"
              ? "Enter attended and conducted classes to see your percentage."
              : "Fill in the components your subject has. Lecture and Tutorial count fully, Practical half, Skill a quarter."}
          </p>
        ) : result.error ? (
          <p className="np-calc__hint">{result.error}</p>
        ) : mode === "single" ? (
          <>
            <div className={`np-calc__pct ${result.safe === false ? "np-bad" : result.safe ? "np-good" : ""}`}>
              {result.percent.toFixed(2)}%
            </div>
            <p className="np-calc__note">{result.note}</p>
          </>
        ) : (
          <>
            <div className="np-calc__pct">{result.percent}%</div>
            <p className="np-calc__note">
              Weighted average of {result.used} {result.used === 1 ? "component" : "components"}, rounded up like ERP.
            </p>
          </>
        )}
      </div>

      {mode === "single" ? (
        <>
          <div className="np-row">
            <NumberField id="np-calc-att" label="Attended" placeholder="34" value={single.attended} onChange={setSingleField("attended")} />
            <NumberField id="np-calc-con" label="Conducted" placeholder="40" value={single.conducted} onChange={setSingleField("conducted")} />
          </div>
          <div className="np-row">
            <NumberField id="np-calc-tcbr" label="TCBR (optional)" placeholder="0" value={single.tcbr} onChange={setSingleField("tcbr")} />
            <NumberField id="np-calc-target" label="Target %" placeholder="85" value={single.target} onChange={setSingleField("target")} />
          </div>
        </>
      ) : (
        <div className="np-calc__grid">
          <span />
          <span className="np-calc__col">Attended</span>
          <span className="np-calc__col">Conducted</span>
          <span className="np-calc__col">TCBR</span>
          {COMPONENTS.map(({ type, label }) => (
            <React.Fragment key={type}>
              <span className="np-calc__rowlabel">{label}</span>
              {["attended", "conducted", "tcbr"].map((field) => (
                <input
                  key={field}
                  className="np-field__input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label={`${label} ${field}`}
                  placeholder="–"
                  value={rows[type][field]}
                  onChange={(e) => setRowField(type, field, e.target.value)}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      )}

      {hasInput && (
        <button type="button" className="np-btn np-btn--quiet" onClick={clear}>
          Clear
        </button>
      )}
    </div>
  );
}
