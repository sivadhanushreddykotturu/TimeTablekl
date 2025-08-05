import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Toast from "../components/Toast";

// Helper to extract main course code
function extractMainCode(code) {
  if (!code) return "";
  // Match alphanumeric code at the start (e.g., 24AD01HF)
  const match = code.match(/^[A-Za-z0-9]+/);
  return match ? match[0] : code;
}

export default function Subjects() {
  const [subjects, setSubjects] = useState({});
  const [editingCode, setEditingCode] = useState("");
  const [editingName, setEditingName] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const navigate = useNavigate();

  // Get unique main course codes from timetable
  const getUniqueMainCodes = () => {
    const timetable = JSON.parse(localStorage.getItem("timetable") || "{}");
    const codes = new Set();
    Object.values(timetable).forEach(daySlots => {
      Object.values(daySlots).forEach(code => {
        if (code && code !== "-") {
          const mainCode = extractMainCode(code);
          codes.add(mainCode);
        }
      });
    });
    return Array.from(codes).sort();
  };

  useEffect(() => {
    // Load existing subject mappings
    const savedSubjects = JSON.parse(localStorage.getItem("subjectMappings") || "{}");
    setSubjects(savedSubjects);
  }, []);

  const closeToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };

  const handleEdit = (code) => {
    setEditingCode(code);
    setEditingName(subjects[code] || "");
  };

  const handleSave = () => {
    if (!editingName.trim()) {
      setToast({
        show: true,
        message: "Subject name cannot be empty",
        type: "error"
      });
      return;
    }
    if (editingName.length > 5) {
      setToast({
        show: true,
        message: "Subject name must be 5 letters or less",
        type: "error"
      });
      return;
    }
    
    const updatedSubjects = {
      ...subjects,
      [editingCode]: editingName.trim()
    };
    setSubjects(updatedSubjects);
    localStorage.setItem("subjectMappings", JSON.stringify(updatedSubjects));
    setEditingCode("");
    setEditingName("");
    setToast({
      show: true,
      message: "Subject name saved successfully!",
      type: "success"
    });
  };

  const handleDelete = (code) => {
    const updatedSubjects = { ...subjects };
    delete updatedSubjects[code];
    setSubjects(updatedSubjects);
    localStorage.setItem("subjectMappings", JSON.stringify(updatedSubjects));
    setToast({
      show: true,
      message: "Subject mapping removed",
      type: "success"
    });
  };

  const handleCancel = () => {
    setEditingCode("");
    setEditingName("");
  };

  const uniqueCodes = getUniqueMainCodes();

  return (
    <>
      <Header onRefresh={() => navigate("/home")} />
      <div className="container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Subject Names</h1>
            <p className="page-subtitle">
              Map your course codes to custom subject names (max 5 letters)
            </p>
          </div>
        </div>
        {uniqueCodes.length === 0 ? (
          <div className="card">
            <p className="text-center">No course codes found. Please log in and load your timetable first.</p>
          </div>
        ) : (
          <div className="subjects-grid">
            {uniqueCodes.map(code => (
              <div key={code} className="subject-card">
                <div className="subject-code">{code}</div>
                {editingCode === code ? (
                  <div className="subject-edit">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      placeholder="Enter name (max 5 letters)"
                      maxLength={5}
                      className="subject-name-input"
                      onKeyPress={(e) => e.key === "Enter" && handleSave()}
                      autoFocus
                    />
                    <div className="subject-actions">
                      <button onClick={handleSave} className="primary small">
                        Save
                      </button>
                      <button onClick={handleCancel} className="secondary small">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="subject-display">
                    <div className="subject-name">
                      {subjects[code] || "Not set"}
                    </div>
                    <div className="subject-actions">
                      <button 
                        onClick={() => handleEdit(code)} 
                        className="primary small"
                      >
                        {subjects[code] ? "Edit" : "Set"}
                      </button>
                      {subjects[code] && (
                        <button 
                          onClick={() => handleDelete(code)} 
                          className="secondary small"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="page-actions">
          <button 
            onClick={() => navigate("/home")} 
            className="primary full-width-mobile"
          >
            Back to Home
          </button>
        </div>
      </div>
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={closeToast}
      />
    </>
  );
} 