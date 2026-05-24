import React from "react";

export default function LogoutModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(5px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          minWidth: 280,
          maxWidth: 320,
          margin: "20px",
          padding: "20px",
          textAlign: "center"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0, marginBottom: "15px" }}>Confirm Logout</h3>
        <p style={{ marginBottom: "25px", color: "var(--text-secondary)" }}>
          Are you sure you want to log out?
        </p>

        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button
            onClick={onClose}
            className="secondary"
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="primary"
            style={{ 
              flex: 1,
              backgroundColor: "#dc3545", // Red color for destructive action
              borderColor: "#dc3545"
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
