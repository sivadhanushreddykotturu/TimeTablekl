// src/hooks/useSwipeNavigation.js
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export const PRIMARY_TABS = [
  "/home",
  "/timetable",
  "/attendance",
  "/grades",
  "/maddys"
];

const SWIPE_DISTANCE_THRESHOLD = 50; // Minimum horizontal px
const SWIPE_VELOCITY_THRESHOLD = 0.3; // px/ms
const ANGLE_RATIO = 1.4; // Must be 1.4x more horizontal than vertical

export function useSwipeNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const touchMoveRef = useRef({ x: 0, y: 0, isHorizontal: null });
  const isInteractingRef = useRef(false);

  useEffect(() => {
    const currentIndex = PRIMARY_TABS.indexOf(location.pathname);
    if (currentIndex === -1) return; // Only active on the 5 primary tabs

    const handleTouchStart = (e) => {
      // If multi-touch (pinch/zoom), ignore
      if (e.touches.length !== 1) return;

      const target = e.target;

      // Ignore touches on interactive components, modals, day selector pills, sliders, games, canvas
      if (
        target.closest(".np-modal-overlay") ||
        target.closest(".np-modal") ||
        target.closest(".np-tabs") ||
        target.closest(".np-slider") ||
        target.closest("input") ||
        target.closest("textarea") ||
        target.closest("select") ||
        target.closest("button") ||
        target.closest("canvas") ||
        target.closest(".no-swipe")
      ) {
        isInteractingRef.current = false;
        return;
      }

      // Check if user is scrolling inside a horizontally scrollable child
      let el = target;
      while (el && el !== document.body && el !== document.documentElement) {
        if (el.scrollWidth > el.clientWidth && el.clientWidth > 0) {
          const style = window.getComputedStyle(el);
          if (style.overflowX === "auto" || style.overflowX === "scroll") {
            isInteractingRef.current = false;
            return;
          }
        }
        el = el.parentElement;
      }

      isInteractingRef.current = true;
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };
      touchMoveRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        isHorizontal: null
      };
    };

    const handleTouchMove = (e) => {
      if (!isInteractingRef.current || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      // Lock direction on first significant movement
      if (touchMoveRef.current.isHorizontal === null) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        if (absX > 8 || absY > 8) {
          if (absX > absY * ANGLE_RATIO) {
            touchMoveRef.current.isHorizontal = true;
          } else {
            touchMoveRef.current.isHorizontal = false;
            isInteractingRef.current = false; // Let browser handle normal vertical scrolling
          }
        }
      }

      touchMoveRef.current.x = touch.clientX;
      touchMoveRef.current.y = touch.clientY;
    };

    const handleTouchEnd = () => {
      if (!isInteractingRef.current || touchMoveRef.current.isHorizontal !== true) {
        isInteractingRef.current = false;
        return;
      }

      const deltaX = touchMoveRef.current.x - touchStartRef.current.x;
      const deltaY = touchMoveRef.current.y - touchStartRef.current.y;
      const deltaTime = Math.max(Date.now() - touchStartRef.current.time, 1);
      const velocityX = Math.abs(deltaX) / deltaTime;

      const isValidDistance = Math.abs(deltaX) >= SWIPE_DISTANCE_THRESHOLD;
      const isValidVelocity = velocityX >= SWIPE_VELOCITY_THRESHOLD && Math.abs(deltaX) >= 25;
      const isHorizontalAngle = Math.abs(deltaX) > Math.abs(deltaY) * ANGLE_RATIO;

      if ((isValidDistance || isValidVelocity) && isHorizontalAngle) {
        if (deltaX < 0) {
          // Swiped LEFT -> go forward to next tab
          if (currentIndex < PRIMARY_TABS.length - 1) {
            const nextTab = PRIMARY_TABS[currentIndex + 1];
            try {
              if (navigator.vibrate) navigator.vibrate(10);
            } catch {}
            navigate(nextTab, { state: { slideDirection: "left" } });
          }
        } else {
          // Swiped RIGHT -> go back to previous tab
          if (currentIndex > 0) {
            const prevTab = PRIMARY_TABS[currentIndex - 1];
            try {
              if (navigator.vibrate) navigator.vibrate(10);
            } catch {}
            navigate(prevTab, { state: { slideDirection: "right" } });
          }
        }
      }

      isInteractingRef.current = false;
      touchMoveRef.current.isHorizontal = null;
    };

    const handleTouchCancel = () => {
      isInteractingRef.current = false;
      touchMoveRef.current.isHorizontal = null;
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [location.pathname, navigate]);
}

export default useSwipeNavigation;
