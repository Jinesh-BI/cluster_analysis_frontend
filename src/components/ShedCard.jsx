// src/components/ShedCard.jsx
//
// Answers "do we have a shed for this cluster, what's it rated, and
// were kits handed out" — pulled from GET /clusters/:id/sheds/.
//
// Unlike MukkadamCard, this one still renders when there's nothing to
// show, because "no shed survey started yet" is itself the answer the
// manager needs to see, not a state to hide.

import { useEffect, useState } from "react";
import { api } from "../api/client";

// Maps the 5-band rating onto the app's existing 3-color status-pill
// system rather than inventing new colors.
const RATING_CLASS = {
  EXCELLENT: "status-pill--paid",
  GOOD: "status-pill--paid",
  AVERAGE: "status-pill--partial",
  POOR: "status-pill--pending",
  NOT_SUITABLE: "status-pill--pending",
};

function PhotoStrip({ images }) {
  if (!images || images.length === 0) return null;
  return (
    <div className="photo-strip">
      {images.map((img, i) => (
        <a key={i} href={img.url} target="_blank" rel="noreferrer" title={img.caption || img.photo_type_display}>
          <img src={img.url} alt={img.caption || img.photo_type_display || "Shed photo"} />
        </a>
      ))}
    </div>
  );
}

export default function ShedCard({ clusterId }) {
  const [data, setData] = useState(undefined); // undefined = loading
  const [showSheds, setShowSheds] = useState(false);
  const [showKits, setShowKits] = useState(false);

  useEffect(() => {
    setData(undefined);
    api
      .getClusterSheds(clusterId)
      .then(setData)
      .catch(() => setData(null));
  }, [clusterId]);

  if (data === undefined) return null; // loading — nothing to show yet
  if (data === null) return null; // request failed — fail quiet, same as MukkadamCard

  const { survey_status, visit_progress, sheds, kits } = data;
  const kitCount = (kits || []).reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="info-card">
      <div className="info-card__title">Shed</div>

      {!survey_status ? (
        <p className="muted" style={{ margin: 0 }}>
          No shed survey assigned to this cluster yet.
        </p>
      ) : (
        <>
          <div className="mukkadam-summary">
            <div>
              <strong>{survey_status.status_display}</strong>
              <div className="muted">
                {survey_status.assigned_to ? `Assigned to ${survey_status.assigned_to}` : "No executive on file"}
              </div>
            </div>
            <div className="mukkadam-summary__advance">
              <div className="stat-box__value" style={{ fontSize: 16 }}>
                {visit_progress.sheds_found}
              </div>
              <div className="stat-box__label">Sheds found</div>
            </div>
          </div>

          <div className="muted" style={{ marginTop: 8 }}>
            {visit_progress.completed + visit_progress.assessment_submitted} of {visit_progress.total_farmers} farmers
            visited
            {visit_progress.no_shed_found > 0 ? ` • ${visit_progress.no_shed_found} found no shed` : ""}
          </div>

          {sheds.length > 0 && (
            <>
              <button className="btn" style={{ marginTop: 10 }} onClick={() => setShowSheds((v) => !v)}>
                {showSheds ? "Hide" : "Show"} {sheds.length} shed{sheds.length > 1 ? "s" : ""}
              </button>

              {showSheds &&
                sheds.map((s) => (
                  <div className="shed-item" key={s.shed_id}>
                    <div className="shed-item__header">
                      <strong>{s.farmer_name || "Unnamed farmer"}</strong>
                      {s.rating_display && (
                        <span className={`status-pill ${RATING_CLASS[s.rating] || ""}`}>{s.rating_display}</span>
                      )}
                    </div>
                    {s.remarks && <div className="muted">{s.remarks}</div>}
                    {s.landmark_note && <div className="muted">Landmark: {s.landmark_note}</div>}
                    <PhotoStrip images={s.images} />
                  </div>
                ))}
            </>
          )}
        </>
      )}

      <div style={{ marginTop: 14, borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
        <div className="muted" style={{ marginBottom: 4 }}>
          Kits {kitCount > 0 ? `— ${kitCount} provided` : "— none provided yet"}
        </div>

        {kitCount > 0 && (
          <>
            <button className="btn" onClick={() => setShowKits((v) => !v)}>
              {showKits ? "Hide" : "Show"} kit details
            </button>

            {showKits &&
              kits.map((c) => (
                <div key={c.category} style={{ marginTop: 10 }}>
                  <div className="muted">
                    {c.category_display} ({c.count})
                  </div>
                  <PhotoStrip images={c.items.map((i) => ({ url: i.image_url }))} />
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}