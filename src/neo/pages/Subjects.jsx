import React, { useState, useEffect } from "react";
import NeoShell from "../Shell.jsx";
import Toast from "../../components/Toast.jsx";

// Helper to extract main course code
function extractMainCode(code) {
  if (!code) return "";
  const match = code.match(/^[A-Za-z0-9]+/);
  return match ? match[0] : code;
}

export default function NeoSubjects() {
  const [subjects, setSubjects] = useState({});
  const [editingCode, setEditingCode] = useState("");
  const [editingName, setEditingName] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const getUniqueMainCodes = () => {
    const timetable = JSON.parse(localStorage.getItem("timetable") || "{}");
    const codes = new Set();
    Object.values(timetable).forEach(daySlots => {
      Object.values(daySlots).forEach(code => {
        if (code && code !== "-") {
          codes.add(extractMainCode(code));
        }
      });
    });
    return Array.from(codes).sort();
  };

  useEffect(() => {
    const savedSubjects = JSON.parse(localStorage.getItem("subjectMappings") || "{}");
    setSubjects(savedSubjects);
  }, []);

  const handleEdit = (code) => {
    setEditingCode(code);
    setEditingName(subjects[code] || "");
  };

  const handleSave = () => {
    if (!editingName.trim()) {
      setToast({ show: true, message: "Subject name cannot be empty", type: "error" });
      return;
    }
    if (editingName.length > 5) {
      setToast({ show: true, message: "Subject name must be 5 letters or less", type: "error" });
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
    setToast({ show: true, message: "Subject name saved!", type: "success" });
  };

  const handleDelete = (code) => {
    const updatedSubjects = { ...subjects };
    delete updatedSubjects[code];
    setSubjects(updatedSubjects);
    localStorage.setItem("subjectMappings", JSON.stringify(updatedSubjects));
    setToast({ show: true, message: "Subject mapping removed", type: "success" });
  };

  const handleCancel = () => {
    setEditingCode("");
    setEditingName("");
  };

  const uniqueCodes = getUniqueMainCodes();

  return (
    <NeoShell>
      <div className="np-pagehead">
        <span className="np-eyebrow">nicknames · max 5 letters</span>
        <h1 className="np-pagehead__title">subjects<i>.</i></h1>
        <p className="np-pagehead__sub">
          Short names show up on your timetable instead of course codes.
        </p>
      </div>

      {uniqueCodes.length === 0 ? (
        <div className="np-empty">
          <h2 className="np-empty__title">no course codes found</h2>
          <p className="np-empty__text">Sign in and load your timetable first.</p>
        </div>
      ) : (
        <div className="np-subjects">
          {uniqueCodes.map(code => (
            <div key={code} className="np-subject">
              <div className="np-subject__code">{code}</div>
              {editingCode === code ? (
                <>
                  <input
                    type="text"
                    className="np-field__input"
                    style={{ marginBottom: 10, padding: "10px 12px" }}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    placeholder="max 5"
                    maxLength={5}
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    autoFocus
                  />
                  <div className="np-subject__row">
                    <button onClick={handleSave} className="np-minibtn" style={{ borderColor: "var(--np-acid)", color: "var(--np-acid)" }}>
                      save
                    </button>
                    <button onClick={handleCancel} className="np-minibtn">
                      cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className={`np-subject__name${subjects[code] ? "" : " is-unset"}`}>
                    {subjects[code] || "not set"}
                  </div>
                  <div className="np-subject__row">
                    <button onClick={() => handleEdit(code)} className="np-minibtn">
                      {subjects[code] ? "edit" : "set name"}
                    </button>
                    {subjects[code] && (
                      <button
                        onClick={() => handleDelete(code)}
                        className="np-minibtn"
                        style={{ borderColor: "var(--np-pink)", color: "var(--np-pink)" }}
                      >
                        remove
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </NeoShell>
  );
}
