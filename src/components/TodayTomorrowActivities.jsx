// src/components/TodayTomorrowActivities.jsx
//
// "What's happening today / tomorrow" section for the Cluster List page.
// Backed by GET /clusters/today/ (optionally ?day=YYYY-MM-DD for
// tomorrow) — already role-scoped server-side, so Admin sees every
// cluster, an AM sees their own + delegated-to-OM clusters, and an OM
// sees only what's assigned to them. No extra filtering needed here.
//
// "Today" comes from the cluster's saved schedule when one exists, and
// falls back to the raw activity date otherwise (see activities_for_day
// in calendar_utils.py) — same rule the calendar day-panel uses.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { localDateStr } from "../utils/dates";

// Small, muted palette — same understated feel as the rest of the app's
// pills, just enough to tell AMs apart at a glance. Deterministic hash so
// the same AM always gets the same color across renders/reloads.
const AM_COLORS = [
  { bg: "rgba(63, 143, 95, 0.15)", text: "#2f6b46" },
  { bg: "rgba(80, 130, 181, 0.18)", text: "#2f5f8a" },
  { bg: "rgba(232, 196, 104, 0.28)", text: "#8a6a1f" },
  { bg: "rgba(181, 80, 47, 0.14)", text: "#b5502f" },
  { bg: "rgba(140, 100, 188, 0.18)", text: "#6a4a94" },
  { bg: "rgba(70, 160, 160, 0.18)", text: "#2f7a7a" },
];

// NEW
function colorForAm(name) {
  if (!name) return null;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AM_COLORS[hash % AM_COLORS.length];
}

// Same pattern as ShedCard.jsx's PhotoStrip — thumbnail links out to
// the full-size photo in a new tab, which is "tap to enlarge" without
// a custom lightbox.
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

// Maps tender's work_status onto the app's existing status-pill
// colors rather than inventing new ones.
const FIELD_STATUS_CLASS = {
  completed: "status-pill--paid",
  in_progress: "status-pill--partial",
  cancelled: "status-pill--pending",
};

export default function TodayTomorrowActivities() {
  const [dayMode, setDayMode] = useState("today"); // "today" | "tomorrow"
  const [clusters, setClusters] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setClusters(null);
    setError(null);
    const day = dayMode === "tomorrow" ? localDateStr(1) : undefined;
    api.getClustersActiveOn(day).then(setClusters).catch((e) => setError(e.message));
  }, [dayMode]);

  const label = dayMode === "tomorrow" ? "Tomorrow" : "Today";
  const totalActivities = clusters?.reduce((sum, c) => sum + c.activity_count, 0) ?? 0;

  return (
    <div className="info-card">
      <div className="info-card__title-row">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="info-card__title" style={{ marginBottom: 0 }}>
            What's going on {label.toLowerCase()}
          </div>
          {clusters?.length > 0 && (
            <span className="status-pill">
              {totalActivities} activit{totalActivities === 1 ? "y" : "ies"} •{" "}
              {clusters.length} cluster{clusters.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
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
      {!clusters && !error && <p className="muted">Loading…</p>}
      {clusters?.length === 0 && (
        <p className="muted">No activities scheduled for {label.toLowerCase()}.</p>
      )}

      {clusters?.length > 0 && (
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {clusters.map((cluster) => (
            <div key={cluster.cluster_id} style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                <Link to={`/clusters/${cluster.cluster_id}`} style={{ fontWeight: 600 }}>
                  {cluster.cluster_name}
                </Link>
                <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  {cluster.am_name && (
                    <span
                      className="status-pill"
                      style={{
                        background: colorForAm(cluster.am_name).bg,
                        color: colorForAm(cluster.am_name).text,
                      }}
                    >
                      AM: {cluster.am_name}
                    </span>
                  )}
                  {cluster.mukkadam_name && (
                    <span className="status-pill">{cluster.mukkadam_name}</span>
                  )}
                  <span className="muted">
                    {cluster.activity_count} activit{cluster.activity_count === 1 ? "y" : "ies"}
                  </span>
                </span>
              </div>

              {cluster.plots.map((a) => (
                <div className="activity-item" key={a.activity_id}>
                  <div>
                    <strong>{a.activity_name}</strong> — {a.status || "—"}
                  </div>
                  <div className="muted">
                    {a.farmer_name || a.farmer_id || "Unknown farmer"} • {a.acre ?? "—"} ac
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
                        <span className="muted">Crew of {fr.actual_crew_size}</span>
                      )}
                    </div>
                  ))}
                  <PhotoStrip images={a.field_report?.flatMap((fr) => fr.images) || []} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}