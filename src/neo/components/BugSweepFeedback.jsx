import React, { useState, useEffect } from "react";
import axios from "axios";
import { FiX, FiSend, FiChevronDown, FiChevronUp, FiAlertCircle, FiCheckCircle } from "react-icons/fi";
import { getCredentials } from "../../../utils/storage.js";
import { trackEvent } from "../../utils/analytics";

const DEFAULT_SWEEP_DURATION_MS = 24 * 60 * 60 * 1000; // 24 Hours
const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdaATurLdf2plEOpdDZNVAm4U8Ws7WLv4uu9LwmRBQM5LAUzg/formResponse";

export default function BugSweepFeedback() {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [hoursLeft, setHoursLeft] = useState(24);

  const [feedbackType, setFeedbackType] = useState("Bug/Issue");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let unmounted = false;

    const initCampaign = async () => {
      try {
        const res = await axios.get(`/announcements.json?t=${Date.now()}`);
        const sweepConfig = res.data?.bugSweep;

        // 1. If remote config says active is false or missing, hide completely
        if (!sweepConfig || !sweepConfig.active) {
          if (!unmounted) setIsVisible(false);
          return;
        }

        const remoteCampaignId = String(sweepConfig.campaignId || "default");
        const durationHours = sweepConfig.durationHours || 24;
        const durationMs = durationHours * 60 * 60 * 1000;

        const storedCampaignId = localStorage.getItem("bug_sweep_campaign_id");
        const now = Date.now();

        // 2. When a NEW Campaign ID arrives, reset the single stored keys in-place (no array piling up)
        if (storedCampaignId !== remoteCampaignId) {
          localStorage.setItem("bug_sweep_campaign_id", remoteCampaignId);
          localStorage.setItem("bug_sweep_start_time", now.toString());
          localStorage.removeItem("bug_sweep_dismissed");
        }

        // 3. Check if user already dismissed or submitted this specific campaign
        if (localStorage.getItem("bug_sweep_dismissed") === "true") {
          if (!unmounted) setIsVisible(false);
          return;
        }

        // 4. Check time window for this campaign
        const startTimeStr = localStorage.getItem("bug_sweep_start_time");
        const startTime = startTimeStr ? parseInt(startTimeStr, 10) : now;
        const elapsed = now - startTime;

        if (elapsed >= durationMs) {
          // 24 hours have passed for this campaign
          if (!unmounted) setIsVisible(false);
          return;
        }

        const remainingHours = Math.max(1, Math.ceil((durationMs - elapsed) / (1000 * 60 * 60)));
        if (!unmounted) {
          setHoursLeft(remainingHours);
          setIsVisible(true);
        }

        // 5. Screen size check: open by default on desktop, collapsed on mobile
        const checkScreen = () => {
          const desktop = window.innerWidth >= 1080;
          setIsDesktop(desktop);
          setIsExpanded(desktop);
        };

        checkScreen();
        window.addEventListener("resize", checkScreen);
        return () => window.removeEventListener("resize", checkScreen);
      } catch (err) {
        console.warn("Could not check bug sweep remote config:", err);
        if (!unmounted) setIsVisible(false);
      }
    };

    initCampaign();
    return () => {
      unmounted = true;
    };
  }, []);

  const handleDismiss = (e) => {
    e.stopPropagation();
    localStorage.setItem("bug_sweep_dismissed", "true");
    setIsVisible(false);
    trackEvent("bug_sweep_dismissed");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMsg("Please describe the issue or feedback.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    const creds = getCredentials();
    const username = creds?.username || "";
    const submittedContact = contact.trim()
      ? `${contact.trim()} (ID: ${username || "guest"})`
      : username ? `ID: ${username}` : "anonymous";

    const formData = new FormData();
    formData.append("entry.1620430637", feedbackType);
    formData.append(
      "entry.1057660527",
      `[24h Bug Sweep]\n${description.trim()}\n\n[Metadata: ${navigator.userAgent.slice(0, 80)}]`
    );
    formData.append("entry.1959359017", submittedContact);

    try {
      await fetch(GOOGLE_FORM_URL, {
        method: "POST",
        mode: "no-cors",
        body: formData,
      });

      setSubmitted(true);
      trackEvent("bug_sweep_feedback_submitted", { type: feedbackType });
      localStorage.setItem("bug_sweep_dismissed", "true");

      setTimeout(() => {
        setIsVisible(false);
      }, 3000);
    } catch (err) {
      console.error("Feedback submit error:", err);
      setErrorMsg("Failed to send. Please check your internet connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className={`np-bug-sweep ${isDesktop ? "np-bug-sweep--desktop" : "np-bug-sweep--mobile"}`}>
      {/* Header / Toggle bar */}
      <div
        className="np-bug-sweep__head"
        onClick={() => !isDesktop && setIsExpanded((prev) => !prev)}
        style={{ cursor: isDesktop ? "default" : "pointer" }}
      >
        <div className="np-bug-sweep__top-bar">
          <div className="np-bug-sweep__meta">
            <span className="np-bug-sweep__badge">⚡ 24h bug sweep</span>
            <span className="np-bug-sweep__timer">{hoursLeft}h left</span>
          </div>

          <div className="np-bug-sweep__actions">
            {!isDesktop && (
              <button
                type="button"
                className="np-bug-sweep__btn-icon np-bug-sweep__btn-toggle"
                aria-label={isExpanded ? "Collapse" : "Expand"}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded((prev) => !prev);
                }}
              >
                {isExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </button>
            )}
            <button
              type="button"
              className="np-bug-sweep__btn-icon np-bug-sweep__btn-close"
              onClick={handleDismiss}
              title="Dismiss for 24h"
              aria-label="Dismiss"
            >
              <FiX size={14} />
            </button>
          </div>
        </div>

        <h3 className="np-bug-sweep__title">
          🛠️ 24h Bug Sweep: Notice anything broken or have suggestions?
        </h3>

        {!isExpanded && !isDesktop && (
          <p className="np-bug-sweep__hint">Tap to report bugs, wrong rooms, or suggest ideas →</p>
        )}
      </div>

      {/* Expanded form body */}
      {isExpanded && (
        <div className="np-bug-sweep__body">
          {submitted ? (
            <div className="np-bug-sweep__success">
              <FiCheckCircle size={24} style={{ color: "var(--np-acid)" }} />
              <div>
                <strong>Thank you!</strong>
                <p>Report received. We are patching reported issues today.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="np-bug-sweep__form">
              <p className="np-bug-sweep__desc">
                Live feedback session today. Notice glitches, wrong room numbers, or have ideas to improve the app?
              </p>

              {/* Feedback type tabs */}
              <div className="np-bug-sweep__types">
                {["Bug/Issue", "Suggestion/Idea", "Other"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`np-bug-sweep__type-btn ${
                      feedbackType === type ? "is-active" : ""
                    }`}
                    onClick={() => setFeedbackType(type)}
                  >
                    {type === "Bug/Issue" ? "🐛 Bug" : type === "Suggestion/Idea" ? "💡 Idea" : "💬 Other"}
                  </button>
                ))}
              </div>

              {/* Description */}
              <div className="np-field" style={{ marginBottom: 10 }}>
                <textarea
                  className="np-field__input np-bug-sweep__textarea"
                  rows={3}
                  placeholder="e.g. Thursday 4th slot has wrong room, attendance calculation glitch, or idea: add widget..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              {/* Contact (Email / Phone) */}
              <div className="np-field" style={{ marginBottom: 12 }}>
                <input
                  type="text"
                  className="np-field__input"
                  style={{ fontSize: 12, padding: "8px 10px" }}
                  placeholder="Email or Phone number (optional)"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
                <span className="np-bug-sweep__contact-hint">
                  📞 Leave your email or phone in case we need more details to reproduce and fix this bug.
                </span>
              </div>

              {errorMsg && (
                <div className="np-bug-sweep__error">
                  <FiAlertCircle size={14} /> <span>{errorMsg}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="np-btn np-bug-sweep__submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting…" : "Submit Report"} <FiSend size={12} style={{ marginLeft: 6 }} />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
