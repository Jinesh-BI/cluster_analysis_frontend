// src/utils/relativeTime.js
//
// "2h ago" style labels for notification timestamps — plain Intl, no
// date library is installed in this project.
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const UNITS = [
  ["year", 31536000],
  ["month", 2592000],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

export function formatRelativeTime(iso) {
  if (!iso) return "";
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  if (Math.abs(seconds) < 60) return "just now";
  for (const [unit, secondsInUnit] of UNITS) {
    if (Math.abs(seconds) >= secondsInUnit) {
      return rtf.format(Math.round(seconds / secondsInUnit), unit);
    }
  }
  return "just now";
}
