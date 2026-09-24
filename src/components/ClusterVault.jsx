// src/components/ClusterVault.jsx
//
// Farmer vault balances for the cluster, so a manager can tell at a
// glance whether farmers have enough prepaid balance left to cover
// their next activity before allocating one. Meant to sit side by side
// with MukkadamCard — "money in from farmers" next to "money out to
// the mukkadam."

import { useEffect, useState } from "react";
import { usePostHog } from "@posthog/react";
import { api } from "../api/client";
import { formatCurrency } from "../utils/format";
import { track } from "../analytics/track";

export default function ClusterVault({ clusterId, deployed }) {
  const posthog = usePostHog();
  const [vault, setVault] = useState(null); // { farmers, total_balance, overdue_count }
  const [error, setError] = useState(null);
  const [openFarmerId, setOpenFarmerId] = useState(null);

  function handleToggleFarmer(farmerId) {
    if (openFarmerId !== farmerId) {
      track(posthog, "vault_farmer_expanded", { cluster_id: clusterId, farmer_id: farmerId });
    }
    setOpenFarmerId(openFarmerId === farmerId ? null : farmerId);
  }

  useEffect(() => {
    setVault(null);
    api.getClusterVault(clusterId).then(setVault).catch((e) => setError(e.message));
  }, [clusterId]);

  if (error) return <p className="error-text">{error}</p>;

  return (
    <div className="info-card">
      <div className="info-card__title-row">
        <div className="info-card__title">Farmer vault</div>
        {vault && (
          <div style={{ textAlign: "right" }}>
            <div className="stat-box__value" style={{ fontSize: 16 }}>
              {formatCurrency(vault.total_balance)}
            </div>
            <div className="stat-box__label">Total balance</div>
          </div>
        )}
      </div>

      {!vault && <p className="muted">Loading…</p>}

      {deployed && vault && vault.total_balance <= 0 && (
        <p className="muted" style={{ color: "var(--color-fail)", marginBottom: 8 }}>
          ⚠ No farmer payments received yet.
        </p>
      )}

      {vault?.overdue_count > 0 && (
        <p className="muted" style={{ color: "var(--color-fail)", marginBottom: 8 }}>
          {vault.overdue_count} {vault.overdue_count === 1 ? "farmer is" : "farmers are"} overdue.
        </p>
      )}

      {vault?.farmers.map((f) => {
        const open = openFarmerId === f.farmer_id;
        return (
          <div key={f.farmer_id} className="vault-farmer">
            <button
              className="vault-farmer__toggle"
              onClick={() => handleToggleFarmer(f.farmer_id)}
            >
              <span>{f.farmer_name}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {f.is_overdue && <span className="status-pill status-pill--pending">Overdue</span>}
                <span>{formatCurrency(f.balance)}</span>
              </span>
            </button>
            {open && (
              <div style={{ padding: "4px 0 8px" }}>
                {f.transactions.length === 0 && <p className="muted">No transactions yet.</p>}
                {f.transactions.map((t) => (
                  <div className="payment-item" key={t.id}>
                    <span
                      className={`checklist-dot ${t.type === "CREDIT" ? "checklist-dot--pass" : "checklist-dot--fail"}`}
                      title={t.type}
                    />
                    <span>
                      {t.type === "CREDIT" ? "+" : "−"}
                      {formatCurrency(t.amount)}
                    </span>
                    <span className="muted">
                      {t.activity_name || "—"}
                      {t.variety ? ` (${t.variety})` : ""}
                      {t.acre ? ` • ${t.acre} ac` : ""}
                    </span>
                    <span className="muted">{t.created_at?.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}