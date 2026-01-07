// Utility to detect campus and get appropriate slot times
// Pattern: XX000XXXXX (positions 3,4,5 are zeros) = Vijayawada
// Any other 10-digit pattern = Hyderabad

// Vijayawada slot times (14 slots)
export const vijayawadaSlotTimes = {
  1: { start: "07:10", end: "08:00" },
  2: { start: "08:00", end: "08:50" },
  3: { start: "09:20", end: "10:10" },
  4: { start: "10:10", end: "11:00" },
  5: { start: "11:10", end: "12:00" },
  6: { start: "12:00", end: "12:50" },
  7: { start: "13:00", end: "13:50" },
  8: { start: "13:50", end: "14:40" },
  9: { start: "14:50", end: "15:40" },
  10: { start: "15:50", end: "16:40" },
  11: { start: "16:40", end: "17:30" },
  12: { start: "17:30", end: "18:20" },
  13: { start: "18:20", end: "19:10" },
  14: { start: "19:10", end: "20:00" },
};

// Hyderabad slot times (9 slots)
export const hyderabadSlotTimes = {
  1: { start: "08:10", end: "09:00" },
  2: { start: "09:00", end: "09:50" },
  3: { start: "10:00", end: "10:50" },
  4: { start: "10:50", end: "11:40" },
  5: { start: "11:50", end: "12:40" },
  6: { start: "12:40", end: "13:20" },
  7: { start: "13:20", end: "14:10" },
  8: { start: "14:10", end: "15:00" },
  9: { start: "15:00", end: "15:50" },
};

/**
 * Detects campus based on username pattern
 * @param {string} username - 10-digit username/ID
 * @returns {string} 'vijayawada' or 'hyderabad'
 */
export function detectCampus(username) {
  if (!username || typeof username !== 'string') {
    // Default to vijayawada if username is not available
    return 'vijayawada';
  }

  // Remove any non-digit characters and check if it's 10 digits
  const digits = username.replace(/\D/g, '');
  
  if (digits.length !== 10) {
    // If not 10 digits, default to vijayawada
    return 'vijayawada';
  }

  // Check pattern: XX000XXXXX (positions 3, 4, 5 are zeros, 0-indexed: positions 2, 3, 4)
  // Pattern: first 2 digits, then 3 zeros, then 5 more digits
  if (digits[2] === '0' && digits[3] === '0' && digits[4] === '0') {
    return 'vijayawada';
  }

  return 'hyderabad';
}

/**
 * Gets slot times based on campus
 * @param {string} username - 10-digit username/ID (optional, defaults to current user)
 * @returns {Object} Slot times object
 */
export function getSlotTimes(username = null) {
  // If username is provided, use it; otherwise get from localStorage
  let targetUsername = username;
  
  if (!targetUsername) {
    const credentials = JSON.parse(localStorage.getItem("erp_creds") || "{}");
    targetUsername = credentials.username;
  }

  const campus = detectCampus(targetUsername);
  
  return campus === 'vijayawada' ? vijayawadaSlotTimes : hyderabadSlotTimes;
}

/**
 * Gets the maximum number of slots for a campus
 * @param {string} username - 10-digit username/ID (optional, defaults to current user)
 * @returns {number} Maximum slot number
 */
export function getMaxSlots(username = null) {
  const slotTimes = getSlotTimes(username);
  return Math.max(...Object.keys(slotTimes).map(Number));
}

