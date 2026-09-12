// src/components/RatingsList.jsx
//
// Shared star-rating display for a completed activity — used by
// DayDetailPanel, PlaygroundPanel, and PieceRow so ratings look the
// same everywhere they show up.

export default function RatingsList({ ratings }) {
  if (!ratings || ratings.length === 0) return null;
  return (
    <div style={{ marginTop: 6 }}>
      {ratings.map((r, i) => (
        <div className="rating-row" key={i}>
          <span className="rating-row__stars">
            {"★".repeat(r.rating)}
            {"☆".repeat(5 - r.rating)}
          </span>{" "}
          <span className="muted">
            {r.rating_type_display || r.rating_type}
            {r.mukkadam_team_name ? ` — ${r.mukkadam_team_name}` : ""}
          </span>
          {r.comments && <div className="muted">{r.comments}</div>}
        </div>
      ))}
    </div>
  );
}