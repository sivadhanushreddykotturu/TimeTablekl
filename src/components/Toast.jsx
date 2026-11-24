import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX } from "react-icons/fi";

/**
 * Toast — a small floating message above the tab bar.
 *
 *   <Toast message="Saved." type="success" isVisible={show} onClose={hide} />
 *
 * Dependency-free on purpose: it is imported by every page, so anything it
 * pulls in is paid for at startup.
 */

const DURATION_MS = 3000;

const ICONS = {
  success: FiCheckCircle,
  error: FiAlertCircle,
  info: FiInfo,
};

export default function Toast({ message, type = "success", isVisible, onClose }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(() => onCloseRef.current?.(), DURATION_MS);
    return () => clearTimeout(timer);
  }, [isVisible, message]);

  if (!isVisible || !message) return null;

  const Icon = ICONS[type] || FiInfo;

  return createPortal(
    <div className="np-toast-host">
      <div
        className={`np-toast np-toast--${type}`}
        role={type === "error" ? "alert" : "status"}
        aria-live={type === "error" ? "assertive" : "polite"}
      >
        <Icon className="np-toast__icon" size={18} aria-hidden="true" />
        <p className="np-toast__text">{message}</p>
        <button className="np-toast__close" onClick={() => onClose?.()} aria-label="Dismiss">
          <FiX size={15} />
        </button>
      </div>
    </div>,
    document.body
  );
}
