import React from "react";
import { Title, Meta, Link as HeadLink } from "react-head";
import { Link } from "react-router-dom";
import AttendanceCalculator from "../components/AttendanceCalculator.jsx";
import { getCredentials } from "../../../utils/storage.js";
import "../neo.css";
import "../core.css";

/** Public attendance calculator: works without an account, and explains the maths. */
export default function CalculatorPage() {
  const signedIn = Boolean(getCredentials());

  return (
    <div className="np-screen">
      <Title>KL Attendance Calculator 2026 | KL University ERP %, Sick Days & Weighted Average</Title>
      <Meta
        name="description"
        content="Free KL University attendance calculator — exact ERP percentage with LTPS weighting, TCBR support, weighted average, and sick-day planner. Updated for 2026. Check how many classes you can miss."
      />
      <Meta
        name="keywords"
        content="KL Calculator, KL University attendance calculator, timetable calculator, attendance percentage, KL ERP, weighted average calculator"
      />
      <HeadLink rel="canonical" href="https://timetablekl.vercel.app/kl-attendance-calculator" />
      <Meta name="robots" content="index, follow" />

      <main className="np-shell">
        <header className="np-topbar">
          <Link to="/" className="np-topbar__brand" aria-label="TimeTable">
            <span className="np-topbar__tile">kl</span>
          </Link>
          <Link to={signedIn ? "/home" : "/"} className="np-pill np-pill--ghost">
            {signedIn ? "Open app" : "Log in"}
          </Link>
        </header>

        <div className="np-pagehead">
          <h1 className="np-pagehead__title">KL Attendance Calculator</h1>
          <p className="np-pagehead__sub">
            Your exact ERP percentage, and how many classes you can miss.
          </p>
        </div>

        <AttendanceCalculator />

        <section className="np-attsum" style={{ marginTop: 22 }}>
          <div>
            <div className="np-shelf__title">Skip the typing</div>
            <div className="np-attsum__label">
              Log in once and TimeTable pulls your attendance, timetable and grades from ERP.
            </div>
          </div>
          <Link to={signedIn ? "/attendance" : "/"} className="np-pill">
            {signedIn ? "My attendance" : "Log in"}
          </Link>
        </section>

        <article className="np-prose">
          <h2>What is the KL Attendance Calculator?</h2>
          <p>
            A free calculator for KL University (KLEF) students to check attendance
            percentage exactly the way the ERP computes it — with LTPS weighting
            (Lecture ×100, Tutorial ×100, Practical ×50, Skilling ×25) and TCBR
            condonation removed from your conducted count. It also works as a
            sick-day planner: enter your numbers and see how many classes you can
            safely miss, or how many you must attend to recover.
          </p>

          <h2>How to use it</h2>
          <p>
            Open your KL ERP attendance page and note the attended and conducted
            numbers for each component (L, T, P, S). Enter them under
            <b> Whole subject</b> for your weighted average — the same percentage the
            university uses. Use <b>One component</b> for a quick check against a
            target percentage: it tells you how many classes you can miss, or how
            many you need to attend.
          </p>

          <h2>How to check attendance in KL ERP</h2>
          <p>
            Log in at the KL University ERP portal, open{" "}
            <b>Attendance → Course-wise attendance</b>, and note the attended,
            conducted and TCBR numbers for each LTPS component. Enter them above —
            or log in here and TimeTable reads them for you.
          </p>

          <h2>Frequently asked questions</h2>

          <h3>How is KL University attendance percentage calculated?</h3>
          <p>
            Attendance % = Attended ÷ (Conducted − TCBR) × 100. TCBR hours are
            condoned directly from conducted hours. Your overall percentage is a
            weighted average across LTPS components, where Lecture and Tutorial
            hours weigh 100, Practical 50, and Skilling 25.
          </p>

          <h3>What is the minimum attendance required in KL University?</h3>
          <p>
            Most KL University courses require at least 75% attendance to be
            eligible for semester-end exams. Exact rules and any condonation
            provisions are in your academic regulations — keep a safe buffer (85% recommended).
          </p>

          <h3>What is TCBR in KL ERP?</h3>
          <p>
            TCBR is the condonation credit shown in the KL ERP attendance
            register — it is deducted from your total conducted classes, giving
            your official attendance percentage.
          </p>

          <h3>How many classes can I miss and still stay safe?</h3>
          <p>
            Enter attended, conducted and your target percentage (most KL courses
            require 75% — check your academic regulations). The calculator tells
            you exactly how many 50-minute classes you can skip, or how many you
            must attend to recover.
          </p>

          <h3>Is my ERP password safe on this site?</h3>
          <p>
            Yes. Credentials are stored only in your own browser's local storage
            and are sent only to the KL University ERP — never to any third-party
            server. The entire codebase is open source, so you can verify this
            yourself.
          </p>

          <h3>Does this work for all KL University courses and campuses?</h3>
          <p>
            Yes — the calculator mirrors the LTPS weighting used across KL
            University programs, and logging in works with any valid KL ERP
            student account.
          </p>

          <h3>Is there an easier way than typing ERP numbers?</h3>
          <p>
            Yes — the TimeTable app pulls your attendance, timetable and grades
            straight from the ERP after one sign-in, and works out safe bunks per
            course automatically. <Link to="/">Open the app</Link>.
          </p>

          <p className="np-prose__foot">
            Built and maintained by{" "}
            <a href="https://github.com/sivadhanushreddykotturu" target="_blank" rel="noreferrer">
              Kotturu Siva Dhanush Reddy
            </a>
            .
          </p>
        </article>
      </main>
    </div>
  );
}
