// src/utils/heatColor.js
//
// Shared by CalendarHeatmap.jsx (reference, backend-computed intensity)
// and PlaygroundCalendar.jsx (plan, locally-computed intensity), so the
// same activity count reads as the same color in both places. That's
// what makes "this day was red on the reference, now it's green on my
// plan" an actually meaningful signal instead of two unrelated scales.

export const HEAT_SCALE = [
  "#eceee9",
  "#bfe3cd",
  "#7fc99a",
  "#e8c468",
  "#e08a4f",
  "#b5502f",
];

export function colorForIntensity(intensity) {
  if (!intensity) return HEAT_SCALE[0];
  const idx = Math.min(
    HEAT_SCALE.length - 1,
    Math.round(intensity * (HEAT_SCALE.length - 1)) || 1,
  );
  return HEAT_SCALE[idx];
}

// Light backgrounds (the first ~half of the scale) read fine with dark
// text; the deeper amber/red ones need white text to stay legible.
export function textColorForIntensity(intensity) {
  return intensity >= 0.55 ? "#ffffff" : "var(--color-text)";
}

// A separate small palette for "which activity is this" (as opposed to
// HEAT_SCALE's "how busy is this day") — deterministic per activity
// name, so the same activity reads as the same dot color everywhere on
// the calendar without needing a legend; hovering/clicking a day still
// spells out the actual names for confirmation.
const ACTIVITY_DOT_COLORS = [
  "#2ad183ff",
  "#07436bff",
  "#fa900eff",
  "#8a13bdff",
  "#b5502f",
  "#daff05ff",
  "#09f3e7ff",
];

export function colorForActivityName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return ACTIVITY_DOT_COLORS[Math.abs(hash) % ACTIVITY_DOT_COLORS.length];
}
