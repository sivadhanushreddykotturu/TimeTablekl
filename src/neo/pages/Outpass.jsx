import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import NeoShell, { NeoModal, NeoSkeleton, NeoLoading } from "../Shell.jsx";
import { NeoField } from "../NeoKit.jsx";
import { NeoDatePicker, NeoTimePicker } from "../components/NeoPickers.jsx";
import Toast from "../../components/Toast.jsx";
import { getCredentials } from "../../../utils/storage.js";
import { checkHostel } from "../../utils/hostel.js";
import { applyHome, applyLocal, inTimesFor, listOutpasses, outpassEnabled } from "../../utils/outpass.js";

const MEALS = ["breakfast", "lunch", "snack", "dinner"];
const NO_MEALS = { breakfast: false, lunch: false, snack: false, dinner: false };
const EMPTY = { date: "", outTime: "", inTime: "", reason: "", outDate: "", outT: "", inDate: "", inT: "", meals: NO_MEALS };

const hhmm = (time) => (time || "").slice(0, 5);
const HALF_HOURS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
/** Slots strictly after `floor` ("HH:MM"); every slot when there is no floor. */
const slotsAfter = (floor) => (floor ? HALF_HOURS.filter((t) => t > floor) : HALF_HOURS);
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const statusTone = (status) => (/approv/i.test(status) ? "var(--np-good)" : /reject|cancel|den/i.test(status) ? "var(--np-pink)" : "var(--np-orange)");

/** "2026-11-08 09:00:30" -> "8 Nov, 09:00" */
function when(stamp) {
  const [date, time] = (stamp || "").split(" ");
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return stamp || "";
  const day = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return time ? `${day}, ${hhmm(time)}` : day;
}

export default function NeoOutpass() {
  const navigate = useNavigate();
  const [gate, setGate] = useState("checking"); // checking | ok | error
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("local");
  const [step, setStep] = useState("form"); // form | review
  const [form, setForm] = useState(EMPTY);
  const [inTimes, setInTimes] = useState([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  // Home outing: keep the four fields consistent whichever one changed (never a return before the leave, never a past leave time).
  const setHome = (patch) =>
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (next.inDate && next.outDate && next.inDate < next.outDate) next.inDate = "";
      if (next.outDate === todayISO() && next.outT && next.outT <= nowHHMM()) next.outT = "";
      if (next.outDate && next.outDate === next.inDate && next.outT && next.inT && next.inT <= next.outT) next.inT = "";
      return next;
    });

  // Local outing: a date of today can't keep an out time that has already passed.
  const setLocalDate = (date) => {
    const stale = date === todayISO() && form.outTime && form.outTime <= nowHHMM();
    set(stale ? { date, outTime: "", inTime: "" } : { date });
    if (stale) setInTimes([]);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listOutpasses());
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Only hostelers belong here: a day scholar who types the address is sent back to Profile.
  useEffect(() => {
    if (!getCredentials() || !outpassEnabled()) {
      navigate("/profile", { replace: true });
      return;
    }
    let live = true;
    checkHostel().then((result) => {
      if (!live) return;
      if (result === "no") navigate("/profile", { replace: true });
      else if (result === "yes") {
        setGate("ok");
        load();
      } else setGate("error");
    });
    return () => {
      live = false;
    };
  }, [navigate, load]);

  const retryGate = () => {
    setGate("checking");
    checkHostel().then((result) => {
      if (result === "no") navigate("/profile", { replace: true });
      else if (result === "yes") {
        setGate("ok");
        load();
      } else setGate("error");
    });
  };

  const openForm = () => {
    setForm(EMPTY);
    setInTimes([]);
    setFormError("");
    setStep("form");
    setOpen(true);
  };

  const pickOutTime = async (value) => {
    set({ outTime: value, inTime: "" });
    setInTimes([]);
    if (!value) return;
    setLoadingTimes(true);
    try {
      setInTimes(await inTimesFor(value));
    } catch (err) {
      setFormError(err.message);
    } finally {
      setLoadingTimes(false);
    }
  };

  const validate = () => {
    if (!form.reason.trim()) return "Write a reason.";
    if (kind === "local") {
      if (!form.date || !form.outTime) return "Choose the date and out time.";
      if (!form.inTime) return "Choose an in time.";
    } else {
      if (!form.outDate || !form.outT || !form.inDate || !form.inT) return "Choose when you leave and when you're back.";
      if (`${form.inDate}T${form.inT}` <= `${form.outDate}T${form.outT}`) return "The return must be after you leave.";
    }
    return "";
  };

  const review = () => {
    const problem = validate();
    setFormError(problem);
    if (!problem) setStep("review");
  };

  const submit = async () => {
    setSubmitting(true);
    setFormError("");
    try {
      const reason = form.reason.trim();
      const res =
        kind === "local"
          ? await applyLocal({ date: form.date, outTime: form.outTime, inTime: form.inTime, reason, meals: form.meals })
          : await applyHome({ out: `${form.outDate}T${form.outT}`, inn: `${form.inDate}T${form.inT}`, reason });
      setOpen(false);
      setToast({ show: true, message: res.message || "Outpass applied.", type: "success" });
      load();
    } catch (err) {
      setStep("form");
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const summary =
    kind === "local"
      ? [
          ["Type", "Local outing"],
          ["Date", form.date],
          ["Out", form.outTime],
          ["In", hhmm(form.inTime)],
          ["Meals", MEALS.filter((m) => form.meals[m]).join(", ") || "none"],
          ["Reason", form.reason.trim()],
        ]
      : [
          ["Type", "Home outing"],
          ["Leave", `${form.outDate} ${form.outT}`],
          ["Back", `${form.inDate} ${form.inT}`],
          ["Reason", form.reason.trim()],
        ];

  return (
    <NeoShell onRefresh={gate === "ok" ? load : undefined}>
      <div className="np-pagehead">
        <div className="np-pagehead__row">
          <h1 className="np-pagehead__title">Outpass</h1>
        </div>
        {gate === "ok" && <p className="np-pagehead__sub">Your hostel outpass requests</p>}
      </div>

      {gate === "checking" ? (
        <NeoLoading text="Checking your hostel status…" />
      ) : gate === "error" ? (
        <div className="np-empty">
          <h2 className="np-empty__title">Couldn't check your hostel status</h2>
          <p className="np-empty__text">Nothing was changed. Try again in a moment.</p>
          <button type="button" className="np-btn" onClick={retryGate}>Try again</button>
        </div>
      ) : (
        <>
          <div className="np-seg" role="tablist" aria-label="Outpass type">
            <button type="button" role="tab" aria-selected={kind === "local"} className={`np-seg__btn${kind === "local" ? " is-active" : ""}`} onClick={() => setKind("local")}>
              Local
            </button>
            <button type="button" role="tab" aria-selected={kind === "home"} className={`np-seg__btn${kind === "home" ? " is-active" : ""}`} onClick={() => setKind("home")}>
              Home
            </button>
          </div>

          <div className="np-btn-zone" style={{ marginBottom: 16 }}>
            <button type="button" className="np-btn" onClick={openForm}>
              {kind === "local" ? "New local outpass" : "New home outpass"}
            </button>
          </div>

          {loading ? (
            <NeoSkeleton variant="card" count={3} text="Fetching your outpasses…" />
          ) : error ? (
            <div className="np-empty">
              <h2 className="np-empty__title">Couldn't load outpasses</h2>
              <p className="np-empty__text">{error.message}</p>
              <button type="button" className="np-btn" onClick={load}>Try again</button>
            </div>
          ) : items.length === 0 ? (
            <div className="np-empty">
              <h2 className="np-empty__title">No outpasses yet</h2>
              <p className="np-empty__text">Your requests will show up here.</p>
            </div>
          ) : (
            items.map((o) => (
              <article key={o.id} className="np-att" style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <span className="np-att__name" style={{ minWidth: 0, overflowWrap: "anywhere" }}>{o.reason || "Outpass"}</span>
                  <b style={{ color: statusTone(o.status), fontSize: 13, flexShrink: 0 }}>{o.status}</b>
                </div>
                <div className="np-att__code" style={{ marginTop: 6 }}>
                  {when(o.out_time)} → {when(o.in_time)}
                </div>
                {o.approved_by && o.approved_by !== "(not set)" && o.approved_by !== "N/A" && (
                  <div className="np-att__detail" style={{ marginTop: 4 }}>Approved by {o.approved_by}</div>
                )}
              </article>
            ))
          )}
        </>
      )}

      <NeoModal open={open} title={step === "review" ? "Review outpass" : kind === "local" ? "New local outpass" : "New home outpass"}onClose={() => !submitting && setOpen(false)}>
        {step === "form" ? (
          <>
            {kind === "local" ? (
              <>
                <NeoDatePicker id="op-date" label="Date" min={todayISO()} value={form.date} onChange={setLocalDate} />
                <NeoTimePicker
                  id="op-out"
                  label="Out time"
                  value={form.outTime}
                  options={form.date === todayISO() ? slotsAfter(nowHHMM()) : HALF_HOURS}
                  emptyText="No times left today. Pick another date."
                  onChange={pickOutTime}
                />
                <NeoTimePicker
                  id="op-in"
                  label="In time"
                  value={form.inTime}
                  options={inTimes.map(hhmm)}
                  disabled={!form.outTime || loadingTimes}
                  placeholder={loadingTimes ? "Loading…" : form.outTime ? "Choose in time" : "Pick an out time first"}
                  emptyText="The ERP has no in-times for that out time."
                  onChange={(inTime) => set({ inTime })}
                />
                <div className="np-field">
                  <div className="np-field__head"><span className="np-field__label">Meals needed</span></div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {MEALS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`np-chipbtn${form.meals[m] ? " is-on" : ""}`}
                        aria-pressed={form.meals[m]}
                        onClick={() => set({ meals: { ...form.meals, [m]: !form.meals[m] } })}
                      >
                        {m[0].toUpperCase() + m.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <NeoDatePicker
                  id="op-leave-d"
                  label="Leave date"
                  min={todayISO()}
                  value={form.outDate}
                  onChange={(outDate) => setHome({ outDate })}
                />
                <NeoTimePicker
                  id="op-leave-t"
                  label="Leave time"
                  value={form.outT}
                  options={form.outDate === todayISO() ? slotsAfter(nowHHMM()) : HALF_HOURS}
                  emptyText="No times left today. Pick another date."
                  onChange={(outT) => setHome({ outT })}
                />
                <NeoDatePicker id="op-back-d" label="Back date" min={form.outDate || todayISO()} value={form.inDate} onChange={(inDate) => setHome({ inDate })} />
                <NeoTimePicker
                  id="op-back-t"
                  label="Back time"
                  value={form.inT}
                  options={form.inDate && form.inDate === form.outDate ? slotsAfter(form.outT) : HALF_HOURS}
                  emptyText="No times left that day. Pick a later date."
                  onChange={(inT) => setHome({ inT })}
                />
              </>
            )}

            <NeoField id="op-reason" label="Reason" maxLength={250} placeholder="Where and why" value={form.reason} onChange={(e) => set({ reason: e.target.value })} />

            {formError && <p className="np-note" role="alert" style={{ color: "var(--np-pink)", marginBottom: 12 }}>{formError}</p>}
            <button type="button" className="np-btn" onClick={review}>Review</button>
          </>
        ) : (
          <>
            <p className="np-note" style={{ marginBottom: 10 }}>This sends a real request to your warden.</p>
            <div className="np-reglist">
              {summary.map(([label, value]) => (
                <div key={label} className="np-reglist__row">
                  <span>{label}</span>
                  <b>{value}</b>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button type="button" className="np-chipbtn" disabled={submitting} onClick={() => setStep("form")}>Back</button>
              <button type="button" className="np-btn" disabled={submitting} onClick={submit}>
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </>
        )}
      </NeoModal>

      <Toast message={toast.message} type={toast.type} isVisible={toast.show} onClose={() => setToast((t) => ({ ...t, show: false }))} />
    </NeoShell>
  );
}
