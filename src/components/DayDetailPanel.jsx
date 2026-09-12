// src/components/DayDetailPanel.jsx
import RatingsList from "./Ratings";

export default function DayDetailPanel({ date, activities, onClose }) {
  return (
    <div className="day-panel">
      <div className="day-panel__header">
        <strong>{date}</strong>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>

      {!activities && <p className="muted">Loading…</p>}
      {activities?.length === 0 && <p className="muted">No activities.</p>}

      {activities?.map((a) => (
        <div className="activity-item" key={a.activity_id}>
          <div>
            <strong>{a.activity_name}</strong> — {a.status || "—"}
            {a.percent && a.percent < 100 ? ` (${a.percent}% here)` : ""}
          </div>
          <div className="muted">
            Plot {a.plot_id} • {a.crop || "—"}
            {a.variety ? ` (${a.variety})` : ""} • {a.acre ?? "—"} ac
          </div>
          <div className="muted">Farmer: {a.farmer_id}</div>
          {a.status === "COMPLETED" && <RatingsList ratings={a.ratings} />}
        </div>
      ))}
    </div>
  );
}
