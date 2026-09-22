// src/components/PlotTimeline.jsx
//
// A compact date-axis view of everything scheduled for one plot — dots
// positioned proportionally by date (so gaps and clusters in the plan
// are visible at a glance), colored the same way the calendar's own
// day-dots are (colorForActivityName), so the two visually match. A
// plain list underneath keeps everything readable without depending on
// hovering a tiny dot — this is meant to answer "what's this plot's
// whole schedule", not to be interacted with.

import { colorForActivityName } from "../utils/heatColor";

const WIDTH = 280;
const HEIGHT = 46;
const MARGIN = 10;

function dayIndex(dateStr) {
  return Math.floor(new Date(`${dateStr}T00:00:00`).getTime() / 86400000);
}

export default function PlotTimeline({ plotId, farmerName, crop, variety, acres, entries }) {
  const cropVariety = crop ? `${crop}${variety ? ` (${variety})` : ""}` : null;
  const acreLabel = acres != null ? `${acres} ac` : null;
  const label = [farmerName, `Plot ${plotId}`, cropVariety, acreLabel].filter(Boolean).join(" • ");
  const dated = entries.filter((e) => e.date).sort((a, z) => (a.date < z.date ? -1 : 1));
  const undatedCount = entries.length - dated.length;

  if (dated.length === 0) {
    return (
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        {label}: nothing scheduled yet{undatedCount ? ` (${undatedCount} waiting to be placed)` : ""}.
      </div>
    );
  }

  const minDay = dayIndex(dated[0].date);
  const maxDay = dayIndex(dated[dated.length - 1].date);
  const span = Math.max(1, maxDay - minDay);

  function xFor(dateStr) {
    if (minDay === maxDay) return WIDTH / 2;
    return MARGIN + ((dayIndex(dateStr) - minDay) / span) * (WIDTH - MARGIN * 2);
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
        {label}&apos;s full schedule{undatedCount ? ` (${undatedCount} not yet placed)` : ""}
      </div>
      <svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ display: "block" }}>
        <line x1={MARGIN} y1={HEIGHT / 2} x2={WIDTH - MARGIN} y2={HEIGHT / 2} stroke="#e2e5df" strokeWidth="2" />
        {dated.map((e, i) => (
          <circle
            key={i}
            cx={xFor(e.date)}
            cy={HEIGHT / 2}
            r={e.completed ? 5 : 4.5}
            fill={colorForActivityName(e.activity_name)}
            stroke="#fff"
            strokeWidth="1.5"
          >
            <title>{`${e.date} — ${e.activity_name}${e.completed ? " (completed)" : ""}`}</title>
          </circle>
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }} className="muted">
        <span>{dated[0].date}</span>
        <span>{dated[dated.length - 1].date}</span>
      </div>
      <div style={{ maxHeight: 110, overflowY: "auto", marginTop: 6 }}>
        {dated.map((e, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "2px 0" }}>
            <span
              style={{ width: 8, height: 8, borderRadius: "50%", background: colorForActivityName(e.activity_name), flexShrink: 0 }}
            />
            <span className="muted" style={{ flexShrink: 0 }}>{e.date}</span>
            <span>{e.activity_name}</span>
            {e.completed && <span className="status-pill status-pill--paid" style={{ marginLeft: "auto" }}>✓</span>}
          </div>
        ))}
      </div>
    </div>
  );
}