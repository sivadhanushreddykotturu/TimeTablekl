// Self-check: node src/utils/attendanceMatch.check.js
import assert from "node:assert/strict";
import { parseCell, findAttendanceItem, isPosted } from "./attendanceMatch.js";

const cell = parseCell("24GMI3101HF-P - S-2 -RoomNo-C018");
assert.deepEqual(cell, { code: "24GMI3101HF", ltps: "P", section: "2" });
assert.equal(parseCell("-"), null);

const items = [
  { course_code: "24GMI3101HF", type: "L", section: "S-1", register_href: "L" },
  { course_code: "24GMI3101HF", type: "P", section: "S-1", register_href: "P1" },
  { course_code: "24GMI3101HF", type: "P", section: "S-2", register_href: "P2" },
  { Coursecode: "24AD2103", Ltps: "T", Section: "5", register_href: "T" },
];
assert.equal(findAttendanceItem(items, cell).register_href, "P2");
assert.equal(findAttendanceItem(items, parseCell("24AD2103-T - S-9 -RoomNo-C1")).register_href, "T"); // single candidate
assert.equal(findAttendanceItem(items, parseCell("99XX9999-L - S-1 -RoomNo-C1")), null);

const today = new Date(2025, 6, 16);
const daily = [
  { date_slot: "15/07/25 H 7", status: "P" },
  { date_slot: "16/07/25 H 7", status: "A" },
];
assert.deepEqual(isPosted(daily, today, 7), { posted: true, status: "A" });
assert.deepEqual(isPosted(daily, today, 8), { posted: false });
assert.deepEqual(isPosted([{ date_slot: "16/07/2025 H 8", status: "P" }], today, 8), { posted: true, status: "P" });
assert.deepEqual(isPosted(undefined, today, 7), { posted: false });

console.log("attendanceMatch ok");
