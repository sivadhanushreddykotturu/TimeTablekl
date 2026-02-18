import React, { useState, useEffect } from "react";
import { getStoredRawSlots, saveSlotDetails, DEFAULT_RAW_SLOTS, SLOT_KEYS } from "../utils/examSlots";

export default function EditSlotModal({ isOpen, onClose, onSave }) {
    // Use a map to store form data: { MN: { start: "HH:MM", end: "HH:MM" }, ... }
    const [formData, setFormData] = useState({});

    useEffect(() => {
        if (isOpen) {
            // Load current slots or default
            const current = getStoredRawSlots() || DEFAULT_RAW_SLOTS;
            setFormData(current);
        }
    }, [isOpen]);

    const handleChange = (key, field, value) => {
        setFormData((prev) => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: value,
            },
        }));
    };

    const handleSave = () => {
        // Basic validation could go here
        const saved = saveSlotDetails(formData); // Saves raw, returns processed
        onSave(saved); // Update parent state with processed details
        onClose();
    };

    const handleReset = () => {
        setFormData(DEFAULT_RAW_SLOTS);
    };

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 1000,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: "var(--bg-secondary)",
                    padding: "20px",
                    borderRadius: "8px",
                    width: "90%",
                    maxWidth: "400px",
                    color: "var(--text-primary)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <h2 style={{ marginTop: 0 }}>Edit Slot Timings</h2>
                <div style={{ maxHeight: "60vh", overflowY: "auto", marginBottom: "20px" }}>
                    {SLOT_KEYS.map((key) => (
                        <div key={key} style={{ marginBottom: "15px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                            <div style={{ fontWeight: "bold", marginBottom: "5px" }}>Slot {key}</div>
                            <div style={{ display: "flex", gap: "10px" }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>Start Time</label>
                                    <input
                                        type="time"
                                        value={formData[key]?.start || ""}
                                        onChange={(e) => handleChange(key, "start", e.target.value)}
                                        style={{
                                            width: "100%",
                                            padding: "8px",
                                            borderRadius: "4px",
                                            border: "1px solid var(--border-color)",
                                            backgroundColor: "var(--bg-tertiary)",
                                            color: "var(--text-primary)",
                                        }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: "block", fontSize: "12px", marginBottom: "4px" }}>End Time</label>
                                    <input
                                        type="time"
                                        value={formData[key]?.end || ""}
                                        onChange={(e) => handleChange(key, "end", e.target.value)}
                                        style={{
                                            width: "100%",
                                            padding: "8px",
                                            borderRadius: "4px",
                                            border: "1px solid var(--border-color)",
                                            backgroundColor: "var(--bg-tertiary)",
                                            color: "var(--text-primary)",
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                    <button
                        onClick={handleReset}
                        style={{
                            padding: "8px 16px",
                            borderRadius: "4px",
                            border: "1px solid var(--border-color)",
                            background: "transparent",
                            color: "var(--text-secondary)",
                            cursor: "pointer",
                            marginRight: "auto"
                        }}
                    >
                        Reset to Default
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            padding: "8px 16px",
                            borderRadius: "4px",
                            border: "none",
                            background: "var(--bg-tertiary)",
                            color: "var(--text-primary)",
                            cursor: "pointer",
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        style={{
                            padding: "8px 16px",
                            borderRadius: "4px",
                            border: "none",
                            background: "var(--accent-primary)",
                            color: "#fff",
                            cursor: "pointer",
                        }}
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
