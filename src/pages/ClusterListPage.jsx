// src/pages/ClusterListPage.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import ClusterCard from "../components/ClusterCard";
import DelegationOverview from "../components/DelegationOverview";
import TodayTomorrowActivities from "../components/TodayTomorrowActivities";
import { useAuth } from "../context/AuthContext";

export default function ClusterListPage() {
  const [clusters, setClusters] = useState(null);
  const [error, setError] = useState(null);
  const [oms, setOms] = useState(null);
  const [omFilter, setOmFilter] = useState("");
  const { user, isManagerTier, logout } = useAuth();

  // Only Admin/AM get the "filter by OM" dropdown — an OM already only
  // ever sees their own clusters, so there's nothing for them to narrow.
  useEffect(() => {
    if (!isManagerTier) return;
    api
      .getManagers()
      .then((list) => setOms(list.filter((m) => m.role === "ASSISTANT_REGIONAL_MANAGER")))
      .catch(() => setOms([]));
  }, [isManagerTier]);

  useEffect(() => {
    api.getClusters(omFilter || undefined).then(setClusters).catch((e) => setError(e.message));
  }, [omFilter]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Clusters</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {isManagerTier && (
            <Link to="/managers" className="btn">
              Managers
            </Link>
          )}
          <button className="btn" onClick={logout}>
            Log out
          </button>
        </div>
      </div>

      <TodayTomorrowActivities />

      {isManagerTier && oms && oms.length > 0 && (
        <select
          className="input"
          style={{ maxWidth: 240, marginBottom: 16 }}
          value={omFilter}
          onChange={(e) => setOmFilter(e.target.value)}
          aria-label="Filter by OM"
        >
          <option value="">All clusters</option>
          {oms.map((om) => (
            <option key={om.id} value={om.id}>
              {om.username}
            </option>
          ))}
        </select>
      )}

      {user?.role === "REGIONAL_MANAGER" && <DelegationOverview />}

      {error && <p className="error-text">{error}</p>}
      {!clusters && !error && <p className="muted">Loading clusters…</p>}
      {clusters && clusters.length === 0 && (
        <p className="muted">No clusters assigned to you yet.</p>
      )}

      <div className="cluster-grid">
        {clusters?.map((cluster) => (
          <ClusterCard key={cluster.id} cluster={cluster} />
        ))}
      </div>
    </div>
  );
}
