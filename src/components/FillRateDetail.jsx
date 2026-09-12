// src/components/FillRateDetail.jsx
//
// The "Fill rate" stat box, made clickable — expands to show the raw
// numbers behind the percentage (start/end of the activity window, how
// many days in it are filled vs idle). Reuses the calendar object the
// page already fetched (build_calendar's days/first_activity_date/
// last_activity_date) — no extra API call, no logic change to fill_rate
// itself.

import { useState } from "react";

export default function FillRateDetail({ calendar }) {
  const [open, setOpen] = useState(false);
  const days = calendar?.days || [];
  const filledDays = days.filter((d) => d.activity_count > 0).length;
  const idleDays = days.length - filledDays;

  return (
    <div
      className="stat-box"
      style={{ cursor: calendar ? "pointer" : "default" }}
      onClick={() => calendar && setOpen((v) => !v)}
    >
      <div className="stat-box__value">{calendar?.fill_rate ?? 0}%</div>
      <div className="stat-box__label">Fill rate{calendar ? (open ? " ▲" : " ▼") : ""}</div>
      {open && calendar && (
        <div className="muted" style={{ marginTop: 6, textAlign: "left", fontSize: 12 }}>
          <div>Start: {calendar.first_activity_date || "—"}</div>
          <div>End: {calendar.last_activity_date || "—"}</div>
          <div>Filled days: {filledDays}</div>
          <div>Idle days: {idleDays}</div>
        </div>
      )}
    </div>
  );
}