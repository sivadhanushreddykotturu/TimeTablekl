export const SLOT_KEYS = ["MN", "AM", "FN", "PM", "EN"];

const minutes = (hours, mins) => hours * 60 + mins;

export const DEFAULT_RAW_SLOTS = {
    MN: { start: "07:30", end: "09:00" },
    AM: { start: "09:30", end: "11:00" },
    FN: { start: "11:30", end: "13:00" },
    PM: { start: "13:45", end: "15:15" },
    EN: { start: "15:30", end: "17:00" },
};

export const formatTime12Header = (timeStr) => {
    if (!timeStr) return "";
    const [hours, mins] = timeStr.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const hours12 = hours % 12 || 12;
    const minsStr = mins < 10 ? `0${mins}` : mins;
    return `${hours12}:${minsStr} ${period}`;
};

export const generateSlotDetails = (rawSlots, isCustom = false) => {
    const details = { inSemester: {}, isCustom };

    Object.keys(rawSlots).forEach((key) => {
        const slot = rawSlots[key];
        if (!slot || !slot.start || !slot.end) return;

        const [endHours, endMins] = slot.end.split(":").map(Number);
        // Unused start calculation but kept for completeness if needed
        // const [startHours, startMins] = slot.start.split(":").map(Number);

        details.inSemester[key] = {
            label: `${formatTime12Header(slot.start)} - ${formatTime12Header(slot.end)}`,
            endMinutes: minutes(endHours, endMins),
            startStr: slot.start,     // "HH:MM"
            endStr: slot.end          // "HH:MM"
        };
    });

    return details;
};

export const getStoredRawSlots = () => {
    try {
        const saved = localStorage.getItem("examSlotDetails");
        if (saved) {
            const parsed = JSON.parse(saved);
            // Basic validation
            if (parsed.MN && parsed.MN.start && parsed.MN.end) {
                return parsed;
            }
        }
    } catch (e) {
        console.error("Failed to parse stored slots", e);
    }
    return null;
};

export const getSlotDetails = () => {
    const raw = getStoredRawSlots();
    if (raw) {
        return generateSlotDetails(raw, true);
    }
    return generateSlotDetails(DEFAULT_RAW_SLOTS, false);
};

export const saveSlotDetails = (rawSlots) => {
    localStorage.setItem("examSlotDetails", JSON.stringify(rawSlots));
    return generateSlotDetails(rawSlots, true);
};

export const resetSlotDetails = () => {
    localStorage.removeItem("examSlotDetails");
    return generateSlotDetails(DEFAULT_RAW_SLOTS, false);
};
