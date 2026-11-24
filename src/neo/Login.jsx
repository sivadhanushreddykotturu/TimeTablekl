import React from "react";
import { Link, useNavigate } from "react-router-dom";
import LoginForm from "./components/LoginForm.jsx";
import "./neo.css";
import "./core.css";

export default function NeoLogin() {
  const navigate = useNavigate();

  return (
    <div className="np-screen">
      <main className="np-shell">
        <section className="np-welcome">
          <div className="np-welcome__art" aria-hidden="true" />
          <span className="np-topbar__tile">kl</span>
          <h1 className="np-welcome__title">Know your next class.</h1>
          <p className="np-welcome__sub">
            Timetable, attendance and grades from KL ERP, in one place.
          </p>
        </section>

        <LoginForm onSuccess={() => navigate("/home", { replace: true })} />

        <p className="np-foot">
          Just need the numbers? <Link to="/kl-calculator">Open the attendance calculator</Link>
        </p>
      </main>
    </div>
  );
}
