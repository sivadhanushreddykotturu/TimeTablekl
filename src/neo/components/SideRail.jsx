import React from "react";
import { NavLink } from "react-router-dom";
import Kbd from "./Kbd.jsx";
import { MOD_KEY } from "../utils/keys.js";

/**
 * Navigation rail for tablets and desktops (the floating bottom bar is for
 * phones). Same four destinations; CSS decides which of the two is visible.
 */
export default function SideRail({ items, showKeys = false }) {
  return (
    <nav className="np-side" aria-label="Main">
      <NavLink to="/home" className="np-side__brand" aria-label="TimeTable home">
        <span className="np-topbar__tile">kl</span>
      </NavLink>

      <div className="np-side__items">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `np-side__item${isActive ? " is-active" : ""}`}
            aria-label={item.label}
            draggable={false}
          >
            <span className="np-side__icon">{item.icon}</span>
            <span className="np-side__label">{item.label}</span>
          </NavLink>
        ))}
      </div>

      {showKeys && (
        <div className="np-side__keys">
          <button
            type="button"
            className="np-side__keybtn"
            onClick={() => window.dispatchEvent(new Event("kbd_palette"))}
            title="Search screens and actions"
          >
            <span>Search</span>
            <span><Kbd>{MOD_KEY}</Kbd><Kbd>K</Kbd></span>
          </button>
          <button
            type="button"
            className="np-side__keybtn"
            onClick={() => window.dispatchEvent(new Event("kbd_help"))}
            title="Keyboard shortcuts"
          >
            <span>Keys</span>
            <span><Kbd>?</Kbd></span>
          </button>
        </div>
      )}
    </nav>
  );
}
