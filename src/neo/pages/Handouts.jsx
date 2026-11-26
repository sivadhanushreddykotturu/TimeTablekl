import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MdChevronRight } from "react-icons/md";
import NeoShell, { NeoModal, NeoLoading, NeoSkeleton } from "../Shell.jsx";
import GuestAuthModal from "../../components/GuestAuthModal.jsx";
import { getCredentials } from "../../../utils/storage.js";
import { clearHandouts, loadHandout, loadHandouts } from "../../utils/handouts.js";
import { parseSyllabus, titleCase } from "../../utils/text.js";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "syllabus", label: "Syllabus" },
  { id: "outcomes", label: "Outcomes" },
  { id: "plan", label: "Plan" },
  { id: "evaluation", label: "Evaluation" },
  { id: "faculty", label: "Faculty" },
];

const has = (handout, id) => {
  if (id === "overview") return true;
  if (id === "syllabus") return Boolean(handout.syllabus);
  if (id === "outcomes") return handout.outcomes.length > 0;
  if (id === "plan") return handout.plans.length > 0;
  if (id === "evaluation") return handout.evaluation.length > 0;
  return handout.faculty.length > 0;
};

function SyllabusPart({ part }) {
  return part.items.length > 0 ? (
    <ul className="np-syl__list">
      {part.items.map((item, i) => (
        <li key={`${item}-${i}`}>{item}</li>
      ))}
    </ul>
  ) : (
    <p className="np-syl__text">{part.text}</p>
  );
}

/** The tab strip, pinned just under the sheet's title bar whatever height that bar has on this screen. */
function PinnedTabs({ children, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const pin = () => {
      const head = ref.current?.closest(".np-modal")?.querySelector(".np-modal__head");
      if (head && ref.current) ref.current.style.top = `${head.offsetHeight}px`;
    };
    pin();
    window.addEventListener("resize", pin);
    return () => window.removeEventListener("resize", pin);
  }, []);
  return (
    <div ref={ref} {...props}>
      {children}
    </div>
  );
}

function Rows({ rows }) {
  return (
    <div className="np-reglist np-reglist--roomy">
      {rows.map(([label, value, sub]) => (
        <div key={label} className="np-reglist__row">
          <span>
            {label}
            {sub ? <small style={{ display: "block" }}>{sub}</small> : null}
          </span>
          <b>{value}</b>
        </div>
      ))}
    </div>
  );
}

/** One delivery plan: a row per session. The ERP names these columns differently for each kind, so pick them by what they hold. */
function PlanRows({ plan }) {
  const { columns, rows } = plan;
  const topic = columns.findIndex((c) => /topic|experiment/i.test(c));
  const meta = columns
    .map((c, i) => i)
    .filter((i) => i !== 0 && i !== topic && (/^(co|coi|co-mapping)$/i.test(columns[i].trim()) || /method/i.test(columns[i])));
  return (
    <div className="np-reglist np-reglist--roomy">
      {rows.map((row, index) => (
        <div key={`${row[0]}-${index}`} className="np-reglist__row">
          <span>
            {row[topic >= 0 ? topic : 1] || "—"}
            {meta.length > 0 && (
              <small style={{ display: "block" }}>{meta.map((i) => row[i]).filter(Boolean).join(" · ")}</small>
            )}
          </span>
          <b>{row[0]}</b>
        </div>
      ))}
    </div>
  );
}

function HandoutBody({ handout, tab, planKind, setPlanKind }) {
  if (tab === "overview") {
    const rows = [
      ["Course code", handout.code],
      ["L-T-P-S", handout.ltps],
      ["Credits", handout.credits],
      ["Pre-requisite", handout.prerequisite],
      ["Coordinator", handout.coordinator],
      ["Term", handout.term],
      ["Department", handout.department],
    ].filter(([, value]) => value);
    return <Rows rows={rows} />;
  }

  if (tab === "syllabus") {
    return parseSyllabus(handout.syllabus).map((block, index) => (
      <section key={`${block.title}-${index}`} className="np-syl">
        {block.title && <h3 className="np-syl__title">{block.title}</h3>}
        {block.subs ? (
          block.subs.map((sub, i) => (
            <div key={`${sub.title}-${i}`} className="np-syl__sub">
              {sub.title && <h4 className="np-syl__subtitle">{sub.title}</h4>}
              <SyllabusPart part={sub} />
            </div>
          ))
        ) : (
          <SyllabusPart part={block} />
        )}
      </section>
    ));
  }

  if (tab === "outcomes") {
    return handout.outcomes.map((o) => (
      <section key={o.co} className="np-syl">
        <div className="np-out__head">
          <h3 className="np-syl__title">{o.co}</h3>
          {o.btl && <span className="np-out__btl">BTL {o.btl}</span>}
        </div>
        <p className="np-syl__text">{o.outcome}</p>
        {o.po && (
          <div className="np-out__tags">
            {o.po.split(",").map((po) => (
              <span key={po} className="np-out__tag">{po.trim()}</span>
            ))}
          </div>
        )}
      </section>
    ));
  }

  if (tab === "plan") {
    const plan = handout.plans.find((p) => p.kind === planKind) || handout.plans[0];
    return (
      <>
        {handout.plans.length > 1 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {handout.plans.map((p) => (
              <button
                key={p.kind}
                type="button"
                className={`np-chipbtn${p.kind === plan.kind ? " is-on" : ""}`}
                aria-pressed={p.kind === plan.kind}
                onClick={() => setPlanKind(p.kind)}
              >
                {p.kind}
              </button>
            ))}
          </div>
        )}
        <PlanRows plan={plan} />
      </>
    );
  }

  if (tab === "evaluation") {
    const groups = [];
    handout.evaluation.forEach((item) => {
      const last = groups[groups.length - 1];
      if (last && last.type === item.type) last.items.push(item);
      else groups.push({ type: item.type, total: item.total_percent, items: [item] });
    });
    return groups.map((group) => (
      <div key={group.type} style={{ marginBottom: 16 }}>
        <h3 className="np-shelf__title" style={{ margin: "4px 0 6px" }}>
          {group.type}
          {group.total ? ` · ${group.total}%` : ""}
        </h3>
        <Rows
          rows={group.items.map((item) => [
            item.component,
            [item.weightage && `${item.weightage}%`, item.max_marks && `${item.max_marks} marks`].filter(Boolean).join(" · ").replace(/ /g, " "),
            [item.duration && `${item.duration} min`, item.date].filter(Boolean).join(" · "),
          ])}
        />
      </div>
    ));
  }

  return <Rows rows={handout.faculty.map((f) => [f.name, f.sections || "—", f.component && `Component ${f.component}`])} />;
}

export default function NeoHandouts() {
  const [courses, setCourses] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const [handout, setHandout] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [tab, setTab] = useState("overview");
  const [planKind, setPlanKind] = useState("");
  const [showGuestModal, setShowGuestModal] = useState(() => !getCredentials());

  const fetchList = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      setCourses(await loadHandouts({ force }));
    } catch (err) {
      setCourses(null);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getCredentials()) fetchList(false);
  }, [fetchList]);

  const refresh = async () => {
    if (!getCredentials()) {
      setShowGuestModal(true);
      return;
    }
    clearHandouts();
    await fetchList(true);
  };

  const openCourse = async (course, force = false) => {
    setOpen(course);
    setHandout(null);
    setDetailError("");
    setTab("overview");
    setPlanKind("");
    try {
      const result = await loadHandout(course, { force });
      setHandout(result);
      setPlanKind(result.plans[0]?.kind || "");
    } catch (err) {
      setDetailError(err.message);
    }
  };

  const list = courses || [];
  const sections = handout ? SECTIONS.filter((s) => has(handout, s.id)) : [];

  return (
    <NeoShell onRefresh={refresh}>
      <div className="np-pagehead">
        <div className="np-pagehead__row">
          <h1 className="np-pagehead__title">Handouts</h1>
        </div>
        {list.length > 0 && <p className="np-pagehead__sub">Tap a course to read its handout</p>}
      </div>

      {loading ? (
        <NeoSkeleton variant="card" count={4} text="Fetching your handouts…" />
      ) : error ? (
        error.code === "NO_LOGIN" ? (
          <div className="np-empty">
            <h2 className="np-empty__title">See your handouts</h2>
            <p className="np-empty__text">{error.message}</p>
            <button type="button" className="np-btn" onClick={() => setShowGuestModal(true)}>Log in</button>
          </div>
        ) : (
          <div className="np-empty">
            <h2 className="np-empty__title">Couldn't load handouts</h2>
            <p className="np-empty__text">{error.message}</p>
            <button type="button" className="np-btn" onClick={() => fetchList(true)}>Try again</button>
          </div>
        )
      ) : courses && list.length === 0 ? (
        <div className="np-empty">
          <h2 className="np-empty__title">No handouts yet</h2>
          <p className="np-empty__text">The ERP has no handouts for this semester.</p>
        </div>
      ) : (
        list.map((course) => (
          <article key={course.course_code} className="np-att">
            <button
              type="button"
              className="np-att__section"
              style={{ padding: "18px 14px 16px 18px" }}
              onClick={() => openCourse(course)}
            >
              <span className="np-att__section-info">
                <span className="np-att__name">{titleCase(course.course_name)}</span>
                <span className="np-att__code">
                  {course.course_code}
                  {course.offered_by ? ` · ${course.offered_by}` : ""}
                </span>
              </span>
              <MdChevronRight className="np-att__chev" size={22} aria-hidden="true" />
            </button>
          </article>
        ))
      )}

      <NeoModal open={Boolean(open)} wide steady title={open?.course_code || "Handout"} onClose={() => setOpen(null)}>
        {open && (
          <>
            <p className="np-note" style={{ marginBottom: 12 }}>{titleCase(open.course_name)}</p>

            {detailError ? (
              <>
                <p className="np-note" style={{ marginBottom: 14 }}>{detailError}</p>
                <button type="button" className="np-btn" onClick={() => openCourse(open, true)}>Try again</button>
              </>
            ) : !handout ? (
              <NeoLoading text="Fetching handout…" />
            ) : (
              <>
                <PinnedTabs className="np-tabs np-handout-tabs" role="tablist" aria-label="Handout sections">
                  {sections.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      role="tab"
                      aria-selected={tab === s.id}
                      className={`np-tab${tab === s.id ? " is-active" : ""}`}
                      onClick={() => setTab(s.id)}
                    >
                      {s.label}
                    </button>
                  ))}
                </PinnedTabs>
                <HandoutBody handout={handout} tab={tab} planKind={planKind} setPlanKind={setPlanKind} />
              </>
            )}
          </>
        )}
      </NeoModal>

      <GuestAuthModal
        isOpen={showGuestModal}
        onClose={() => setShowGuestModal(false)}
        pageType="handouts"
        onSuccess={async () => {
          setShowGuestModal(false);
          await fetchList(true);
        }}
      />
    </NeoShell>
  );
}
