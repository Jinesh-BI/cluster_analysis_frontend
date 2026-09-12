// src/utils/gapSchedule.js
//
// Standard grape-cultivation activity sequence — each activity's day
// offset from ITS OWN PLOT'S Pruning date. Per-plot only: every plot
// gets its own Pruning date, and the rest of that SAME plot's activities
// (if they match this table) can auto-follow from it. Never touches
// another plot. Names must match `activity_name` in the DB exactly.

export const GAP_SCHEDULE = [
  { offset: 0, activity_name: "Pruning (छाटणी)" },
  { offset: 1, activity_name: "Pasting (पेस्टींग)" },
  { offset: 2, activity_name: "Cane Tying (काडी बांधणे)" },
  { offset: 15, activity_name: "1st Fail Fut Removal (पहिली फेलफुट काढणे)" },
  { offset: 23, activity_name: "2nd Fail Fut Removal (दुसरी फेलफुट काढणे)" },
  { offset: 25, activity_name: "1st Hand Dipping (पहिली डिपिंग)" },
  { offset: 35, activity_name: "Shenda Stopping (शेंडा स्टॉपिंग)" },
  { offset: 36, activity_name: "1st Lateral Removal (बगल काढणे)" },
  { offset: 38, activity_name: "Shoot Tying (Strings) (शूट बांधणे - सुतळी)" },
  { offset: 55, activity_name: "1st Thinning (पहिली थिनिंग)" },
  { offset: 57, activity_name: "2nd Hand Dipping (दुसरी डिपिंग)" },
  { offset: 65, activity_name: "Bunch Selection (बंच सिलेक्शन)" },
  { offset: 70, activity_name: "Variation Removal (व्हेरिएशन काढणे)" },
  { offset: 80, activity_name: "Bunch Tying (बंच बांधणे)" },
  { offset: 85, activity_name: "Finger Thinning (बोटाळणी)" },
  {
    offset: 90,
    activity_name: "Paper Wrapping (Acres basis) (पेपर रॅपिंग - एकरी)",
  },
];

export const PRUNING_ACTIVITY_NAME = "Pruning (छाटणी)";

export const GAP_OFFSET_BY_NAME = Object.fromEntries(
  GAP_SCHEDULE.map((g) => [g.activity_name, g.offset]),
);

export function isGapScheduleActivity(activityName) {
  return Object.prototype.hasOwnProperty.call(GAP_OFFSET_BY_NAME, activityName);
}

export function isPruningActivity(activityName) {
  return activityName === PRUNING_ACTIVITY_NAME;
}

// Given ANY gap-schedule activity's name and the date it's just been
// placed on, derives what Pruning's date would be (the anchor the whole
// table is offset from) — e.g. placing Cane Tying (offset 2) on the 6th
// implies Pruning's date is the 4th. This is what generalizes
// auto-allocate to any of the 16 activities, not just Pruning itself.
export function deriveAnchorDate(activityName, placedDate) {
  const offset = GAP_OFFSET_BY_NAME[activityName];
  if (offset === undefined) return null;
  return addDaysToDateStr(placedDate, -offset);
}

// "YYYY-MM-DD" + integer days -> "YYYY-MM-DD", local time (same
// deliberate choice as dates.js's localDateStr — no UTC conversion).
export function addDaysToDateStr(dateStr, offsetDays) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + offsetDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
