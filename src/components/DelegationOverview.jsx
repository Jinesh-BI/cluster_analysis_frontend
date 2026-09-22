// src/components/DelegationOverview.jsx
//
// Regional-Manager-only. Shows how much of what Admin gave them has
// been further delegated to an Assistant Regional Manager, and to whom
// — the "am I keeping my team's workload visible and balanced" check.
// Renders nothing for anyone else; OverviewPage only mounts this
// when user.role === "REGIONAL_MANAGER" anyway, but the guard here is
// cheap insurance against it being reused somewhere that check slips.

import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function DelegationOverview() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getManagerOverview().then(setOverview).catch((e) => setError(e.message));
  }, []);

  if (error) return null; // e.g. called by a non-RM — fail quiet, this is a bonus widget
  if (!overview) return null;

  return (
    <div className="info-card" style={{ marginBottom: 20 }}>
      <div className="info-card__title">Your team&apos;s delegation</div>
      <div className="stat-row" style={{ marginBottom: overview.by_arm.length ? 10 : 0 }}>
        <div className="stat-box">
          <div className="stat-box__value">{overview.total_clusters}</div>
          <div className="stat-box__label">Assigned to you</div>
        </div>
        <div className="stat-box">
          <div className="stat-box__value">{overview.assigned_to_arm}</div>
          <div className="stat-box__label">Delegated to an OM</div>
        </div>
        <div className="stat-box">
          <div className="stat-box__value">{overview.unassigned}</div>
          <div className="stat-box__label">Not yet delegated</div>
        </div>
      </div>

      {overview.by_arm.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {overview.by_arm.map((a) => (
            <span key={a.manager_id} className="status-pill">
              {a.username} — {a.cluster_count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}