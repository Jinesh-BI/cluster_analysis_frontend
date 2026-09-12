// src/utils/dates.js

// "YYYY-MM-DD" for today + offsetDays, in the browser's local time —
// deliberately not toISOString() (that's UTC and can land on the wrong
// day). Used to ask the backend for a specific day's activities.
export function localDateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

// A block's "pieces" always sum to 100%. Card/panel headers used to show
// the activity's raw original date (stale the moment a schedule piece
// moved it) instead of where it's actually placed now — this is the one
// place both BlockList and PlaygroundPanel read from, so they can never
// show two different dates for the same block again.
export function blockSummaryDate(block) {
  const dated = block.pieces.filter((p) => p.date);
  if (dated.length === 0) return null;
  const allSameDay = dated.every((p) => p.date === dated[0].date);
  return allSameDay ? dated[0].date : null; // split across days — the split bar/piece list already shows each one
}

export function toLocalDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Expands holiday brackets ({start_date, end_date, label}) into a flat
// "YYYY-MM-DD" -> label lookup, for Calendar's getDayData to check
// against. Inclusive on both ends.
export function holidayDateMap(holidays) {
  const map = {};
  for (const h of holidays || []) {
    const cursor = new Date(`${h.start_date}T00:00:00`);
    const end = new Date(`${h.end_date}T00:00:00`);
    while (cursor <= end) {
      map[toLocalDateStr(cursor)] = h.label;
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return map;
}