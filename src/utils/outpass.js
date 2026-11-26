// Hostel outpass through the backend: list, allowed in-times, apply local (hours) / home (days).
import { API_CONFIG } from "../config/api.js";
import { erpCall } from "./erpCall.js";

export const outpassEnabled = () =>
  Boolean(
    API_CONFIG.OUTPASS_URL &&
      API_CONFIG.OUTPASS_INTIMES_URL &&
      API_CONFIG.OUTPASS_LOCAL_URL &&
      API_CONFIG.OUTPASS_HOME_URL
  );

const withSeconds = (time) => (time.length === 5 ? `${time}:00` : time);

/** Every outpass request, as the ERP lists them (newest first). */
export async function listOutpasses() {
  const data = await erpCall(API_CONFIG.OUTPASS_URL);
  return data.outpasses || [];
}

/** In-times the ERP allows for an out-time ("HH:MM"). */
export async function inTimesFor(outTime) {
  const data = await erpCall(API_CONFIG.OUTPASS_INTIMES_URL, { out_time: withSeconds(outTime) });
  return data.in_times || [];
}

/** Local outing (same day, hours). `meals` is { breakfast, lunch, snack, dinner } booleans. */
export async function applyLocal({ date, outTime, inTime, reason, meals }) {
  const yn = (on) => (on ? "YES" : "NO");
  return erpCall(API_CONFIG.OUTPASS_LOCAL_URL, {
    date,
    out_time: withSeconds(outTime),
    in_time: withSeconds(inTime),
    reason,
    breakfast: yn(meals.breakfast),
    lunch: yn(meals.lunch),
    snack: yn(meals.snack),
    dinner: yn(meals.dinner),
  });
}

/** Home outing (days). Date-times are "YYYY-MM-DDTHH:MM". */
export async function applyHome({ out, inn, reason }) {
  const fix = (value) => `${value.replace("T", " ")}:00`;
  return erpCall(API_CONFIG.OUTPASS_HOME_URL, { out_datetime: fix(out), in_datetime: fix(inn), reason });
}
