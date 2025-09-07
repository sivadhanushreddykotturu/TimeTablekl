import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import CaptchaModal from "../components/CaptchaModal";
import Toast from "../components/Toast";

export default function Attendance() {
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const navigate = useNavigate();

  const handleRefresh = () => {
    setShowCaptchaModal(true);
  };

  const handleCaptchaSuccess = (newTimetable) => {
    setToast({
      show: true,
      message: "Timetable synced successfully!",
      type: "success"
    });
  };

  const closeToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };

  return (
    <>
      <Header onRefresh={handleRefresh} />

      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Attendance</h1>
          <div className="action-buttons">
            <button onClick={() => navigate("/home")}>
              Back to Home
            </button>
          </div>
        </div>

        <div className="card">
          <p className="text-center">Attendance features coming soon...</p>
        </div>
      </div>

      <CaptchaModal
        isOpen={showCaptchaModal}
        onClose={() => setShowCaptchaModal(false)}
        onSuccess={handleCaptchaSuccess}
      />

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={closeToast}
      />
    </>
  );
}
