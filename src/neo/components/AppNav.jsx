import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { MdHome, MdCalendarMonth, MdPieChart } from "react-icons/md";
import JellyNav from "./JellyNav.jsx";
import SideRail from "./SideRail.jsx";
import KeyboardLayer from "./KeyboardLayer.jsx";
import { avatarUrl, getAvatarSeed } from "../utils/avatar.js";

// Screens that show the tab bar (everything inside the signed-in app).
const NAV_ROUTES = /^\/(home|timetable|attendance|profile|grades|internals|subjects|maddys|exam)(\/|$)/;

const LAPTOP = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";

/** True on laptop / desktop screens (wide, with a mouse or trackpad). */
function useLaptop() {
  const [match, setMatch] = useState(() => window.matchMedia(LAPTOP).matches);
  useEffect(() => {
    const query = window.matchMedia(LAPTOP);
    const onChange = (event) => setMatch(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return match;
}

const SCROLL_THRESHOLD = 60;

const PULL_TO_OPEN = 10;   // px of pull at the top that opens the labels again
const MOMENTUM_MS = 1200;  // a fling keeps scrolling this long after the finger lifts

/**
 * Labels fold away while scrolling down and come back when the user scrolls
 * up or pulls down a little at the top. Only the user's own scrolling counts:
 * the jump to the top on a tab change, or a page getting shorter, never opens
 * the bar. So a folded bar stays folded from tab to tab until it is asked for.
 */
function useCompactOnScroll(pathname) {
  const [compact, setCompact] = useState(false);
  const lastY = useRef(0);
  const travelled = useRef(0);
  const touching = useRef(false);
  const lastInput = useRef(0);

  // a new screen: forget the gesture that brought us here
  useEffect(() => {
    lastY.current = 0;
    travelled.current = 0;
    touching.current = false;
    lastInput.current = 0;
  }, [pathname]);

  useEffect(() => {
    let touchY = 0;
    const inNav = (event) => event.target instanceof Element && event.target.closest(".np-nav");
    const userIsScrolling = () => touching.current || performance.now() - lastInput.current < MOMENTUM_MS;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      lastY.current = y;
      if (!userIsScrolling()) return;

      if (y <= 8 && delta < 0) {
        travelled.current = 0;
        setCompact(false);
        return;
      }
      // a change of direction restarts the measurement
      if (delta > 0 !== travelled.current > 0) travelled.current = 0;
      travelled.current += delta;

      if (travelled.current > SCROLL_THRESHOLD) setCompact(true);
      else if (travelled.current < -SCROLL_THRESHOLD) setCompact(false);
    };

    // already at the top: a small pull down (or wheeling up) opens the labels
    const onWheel = (event) => {
      lastInput.current = performance.now();
      if (window.scrollY <= 0 && event.deltaY < 0) setCompact(false);
    };
    const onTouchStart = (event) => {
      if (inNav(event)) return;
      touching.current = true;
      touchY = event.touches[0].clientY;
    };
    const onTouchMove = (event) => {
      if (!touching.current) return;
      if (window.scrollY <= 0 && event.touches[0].clientY - touchY > PULL_TO_OPEN) setCompact(false);
    };
    const onTouchEnd = () => {
      if (!touching.current) return;
      touching.current = false;
      lastInput.current = performance.now();
    };
    const onInput = (event) => {
      if (!inNav(event)) lastInput.current = performance.now();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onInput);
    window.addEventListener("mousedown", onInput);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("keydown", onInput);
      window.removeEventListener("mousedown", onInput);
    };
  }, []);

  return compact;
}

/**
 * The app's tab bar. Mounted once, above the routes, so it never remounts on
 * navigation and its motion carries through page changes.
 */
export default function AppNav() {
  const { pathname } = useLocation();
  const [avatarSeed, setAvatarSeed] = useState(getAvatarSeed);
  const compact = useCompactOnScroll(pathname);
  const laptop = useLaptop();

  // every screen starts at its top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    // the profile page announces a new avatar so the tab updates with it
    const onAvatar = (event) => setAvatarSeed(event.detail);
    window.addEventListener("avatar_changed", onAvatar);
    return () => window.removeEventListener("avatar_changed", onAvatar);
  }, []);

  if (!NAV_ROUTES.test(pathname)) return null;

  const items = [
    { to: "/home", label: "Today", icon: <MdHome size={26} /> },
    { to: "/timetable", label: "Week", icon: <MdCalendarMonth size={26} /> },
    { to: "/attendance", label: "Attendance", icon: <MdPieChart size={26} /> },
    {
      to: "/profile",
      label: "Profile",
      icon: <img className="np-jelly__avatar" src={avatarUrl(avatarSeed)} alt="" draggable={false} />,
    },
  ];

  const railItems = items.map((item) =>
    item.to === "/profile"
      ? { ...item, icon: <img className="np-side__avatar" src={avatarUrl(avatarSeed)} alt="" draggable={false} /> }
      : { ...item, icon: React.cloneElement(item.icon, { size: 24 }) }
  );

  return (
    <>
      <JellyNav
        items={items}
        compact={compact}
        onReselect={(item) => {
          // tapping the tab you're on: Attendance refetches, the others scroll up
          if (item.to === "/attendance") window.dispatchEvent(new CustomEvent("refresh_attendance_tab"));
          else window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
      <SideRail items={railItems} showKeys={laptop} />
      {laptop && <KeyboardLayer />}
    </>
  );
}
