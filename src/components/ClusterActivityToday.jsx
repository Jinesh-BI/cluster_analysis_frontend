// src/components/ClusterActivityToday.jsx
//
// "What's happening today / tomorrow" for ONE cluster, on the Cluster
// Detail page. Reuses the same GET /clusters/:id/calendar/:day/ endpoint
// the calendar day-panel already uses (activities_for_day — schedule-
// aware, falls back to Activity.date_time) so this and the calendar
// panel never disagree about what a given day shows.

import { useEffect, useState } from "react";
import { api } from "../api/client";
import { localDateStr } from "../utils/dates";

// Same pattern as TodayTomorrowActivities.jsx (Cluster List page) — tap
// a thumbnail to open the full-size proof photo in a new tab.
function PhotoStrip({ images }) {
  if (!images || images.length === 0) return null;
  return (
    <div className="photo-strip">
      {images.map((img, i) => (
        <a key={i} href={img.url} target="_blank" rel="noreferrer" title={img.phase}>
          <img src={img.url} alt={img.phase || "Field proof photo"} />
        </a>
      ))}
    </div>
  );
}

// Maps tender's work_status onto the app's existing status-pill colors.
const FIELD_STATUS_CLASS = {
  completed: "status-pill--paid",
  in_progress: "status-pill--partial",
  cancelled: "status-pill--pending",
};

// A mukkadam's attendance count is GLOBAL — one number per mukkadam
// per day. Saving here updates it everywhere that mukkadam shows up
// today, not just this cluster.
function AttendanceBadge({ mukkadamId, mukkadamName, crewSize, day, count, effectiveFrom, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(count ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(count ?? "");
  }, [count]);

  if (!mukkadamId) return null;

  if (!editing) {
    // Carried forward from an earlier day, not entered specifically
    // for today — a small hint so it doesn't look like stale data.
    const carried = count != null && effectiveFrom && effectiveFrom !== day;
    return (
      <span
        className="status-pill"
        style={{ cursor: "pointer" }}
        onClick={() => setEditing(true)}
        title={`Set today's attendance for ${mukkadamName || "this mukkadam"}`}
      >
        Attendance: {count != null ? count : "—"}
        {crewSize ? ` / ${crewSize}` : ""}
        {carried ? ` (since ${effectiveFrom})` : ""} ✎
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ width: 56 }}
        autoFocus
      />
      <button
        className="btn btn-primary"
        disabled={saving || value === ""}
        onClick={async () => {
          setSaving(true);
          try {
            await api.setMukkadamAttendance({
              mukkadam_id: mukkadamId,
              mukkadam_name: mukkadamName,
              date: day,
              count: Number(value),
            });
            onSaved(Number(value));
            setEditing(false);
          } catch (e) {
            alert(e.message);
          } finally {
            setSaving(false);
          }
        }}
      >
        Save
      </button>
      <button className="btn" onClick={() => setEditing(false)}>
        Cancel
      </button>
    </span>
  );
}

export default function ClusterActivityToday({ clusterId }) {
  const [dayMode, setDayMode] = useState("today"); // "today" | "tomorrow"
  const [activities, setActivities] = useState(null);
  const [attendance, setAttendance] = useState({}); // mukkadam_id -> { count, crew_size }
  const [error, setError] = useState(null);

  useEffect(() => {
    setActivities(null);
    setError(null);
    const day = localDateStr(dayMode === "tomorrow" ? 1 : 0);
    Promise.all([api.getCalendarDay(clusterId, day), api.getMukkadamAttendance(day)])
      .then(([acts, att]) => {
        setActivities(acts);
        setAttendance(att.results || {});
      })
      .catch((e) => setError(e.message));
  }, [clusterId, dayMode]);

  const label = dayMode === "tomorrow" ? "Tomorrow" : "Today";

  return (
    <div className="info-card">
      <div className="info-card__title-row">
        <div className="info-card__title">{label}&apos;s activities</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className={dayMode === "today" ? "btn btn-primary" : "btn"}
            onClick={() => setDayMode("today")}
          >
            Today
          </button>
          <button
            className={dayMode === "tomorrow" ? "btn btn-primary" : "btn"}
            onClick={() => setDayMode("tomorrow")}
          >
            Tomorrow
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {!activities && !error && <p className="muted">Loading…</p>}
      {activities?.length === 0 && (
        <p className="muted">No activities scheduled for {label.toLowerCase()}.</p>
      )}

      {activities?.map((a) => {
        const day = localDateStr(dayMode === "tomorrow" ? 1 : 0);
        return (
          <div className="activity-item" key={a.activity_id}>
            <div>
              <strong>{a.activity_name}</strong> — {a.status || "—"}
              {a.percent && a.percent < 100 ? ` (${a.percent}% here)` : ""}
            </div>
            <div className="muted">
              {a.farmer_name || a.farmer_id || "Unknown farmer"} • Plot {a.plot_id || "—"} •{" "}
              {a.acre ?? "—"} ac
              {a.crop ? ` • ${a.crop}` : ""}
              {a.variety ? ` (${a.variety})` : ""}
            </div>

            {a.field_report?.map((fr, i) => (
              <div
                key={i}
                style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 }}
              >
                <span className={`status-pill ${FIELD_STATUS_CLASS[fr.work_status] || ""}`}>
                  {(fr.work_status || "—").replace(/_/g, " ")}
                </span>
                {fr.mukkadam_name && <span className="muted">{fr.mukkadam_name}</span>}
                {fr.actual_crew_size != null && (
                  <span className="muted">Reported crew of {fr.actual_crew_size}</span>
                )}
                <AttendanceBadge
                  mukkadamId={fr.mukkadam_id}
                  mukkadamName={fr.mukkadam_name}
                  crewSize={attendance[fr.mukkadam_id]?.crew_size}
                  day={day}
                  count={attendance[fr.mukkadam_id]?.count}
                  effectiveFrom={attendance[fr.mukkadam_id]?.effective_from}
                  onSaved={(newCount) =>
                    setAttendance((prev) => ({
                      ...prev,
                      [fr.mukkadam_id]: {
                        ...(prev[fr.mukkadam_id] || {}),
                        count: newCount,
                        effective_from: day,
                      },
                    }))
                  }
                />
              </div>
            ))}
            <PhotoStrip images={a.field_report?.flatMap((fr) => fr.images) || []} />
          </div>
        );
      })}
    </div>
  );
}