import React from "react";
import { NeoModal } from "../neo/Shell.jsx";
import LoginForm from "../neo/components/LoginForm.jsx";
import { trackEvent } from "../utils/analytics";

const REASONS = {
  attendance: "to see your live attendance and how many classes you can miss.",
  timetable: "to load your weekly timetable.",
  grades: "to see your CGPA, SGPA and marks.",
  exam: "to load your exam dates and seating.",
  calculator: "to pull your real numbers into the calculator.",
  default: "to load your timetable, attendance and grades.",
};

/**
 * Login sheet shown when someone opens a screen that needs their ERP data.
 * Logging in also stores their timetable (it comes back with the login).
 */
export default function GuestAuthModal({ isOpen, onClose, pageType = "default", onSuccess }) {
  return (
    <NeoModal open={isOpen} title="Log in" onClose={onClose}>
      <p className="np-note" style={{ marginBottom: 18 }}>
        Use your KL ERP account {REASONS[pageType] || REASONS.default}
      </p>
      <LoginForm
        idPrefix="np-guest"
        onError={(reason) => trackEvent("guest_modal_login_failed", { pageType, reason })}
        onSuccess={async (data) => {
          trackEvent("guest_modal_login_success", { pageType });
          await onSuccess?.(data);
          onClose?.();
        }}
      />
    </NeoModal>
  );
}
