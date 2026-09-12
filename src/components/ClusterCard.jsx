// src/components/ClusterCard.jsx
import { Link } from "react-router-dom";

// "OM" is the display label for what the backend still calls
// ASSISTANT_REGIONAL_MANAGER (assignment_chain.assistant_manager) —
// only the label changed, not the role slug, so this stays the one
// place that naming lives on the frontend.
function ManagerTag({ label, name, unassignedText, unassignedCls }) {
  if (name) {
    return (
      <span className="status-pill status-pill--paid">
        {label}: {name}
      </span>
    );
  }
  return <span className={`status-pill ${unassignedCls}`}>{unassignedText}</span>;
}

export default function ClusterCard({ cluster }) {
  const chain = cluster.assignment_chain || {};

  return (
    <Link
      to={`/clusters/${cluster.id}`}
      className={`cluster-card ${cluster.deployed ? "cluster-card--deployed" : ""}`}
    >
      <div>
        <div className="cluster-card__title-row">
          <div className="cluster-card__title">{cluster.name}</div>
          {cluster.deployed && <span className="deployed-badge">Deployed</span>}
        </div>
        <div className="cluster-card__meta">
          {cluster.season} {cluster.year}
          {cluster.first_activity_date ? ` • from ${cluster.first_activity_date}` : ""}
        </div>
        <div className="cluster-card__tags">
          <ManagerTag
            label="AM"
            name={chain.regional_manager?.username}
            unassignedCls="status-pill--pending"
            unassignedText="No RM"
          />
          <ManagerTag
            label="OM"
            name={chain.assistant_manager?.username}
            unassignedCls="status-pill--partial"
            unassignedText="Not delegated"
          />
        </div>
      </div>

      <div className="checklist">
        {cluster.checklist.map((item) => (
          <div className="checklist-row" key={item.key}>
            <span
              className={`checklist-dot ${item.passed ? "checklist-dot--pass" : "checklist-dot--fail"}`}
            />
            <span>
              {item.label} ({item.passed_count}/{item.total_count})
            </span>
          </div>
        ))}
      </div>

      <div className="cluster-card__footer">
        <span>{cluster.farmer_count} farmers</span>
        <span>{cluster.total_acres} acres</span>
      </div>
    </Link>
  );
}