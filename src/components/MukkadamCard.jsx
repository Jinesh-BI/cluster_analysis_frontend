// src/components/MukkadamCard.jsx
//
// Fetches the cluster's mukkadam (labor contractor) from the backend,
// which resolves head_mukkadam against the external tender service.
// Renders nothing if the cluster has no mukkadam assigned, or if the
// lookup failed — this card is a bonus, not a blocker for the rest of
// the page.

import { useEffect, useState } from "react";
import { api } from "../api/client";
import { formatCurrency } from "../utils/format";

const PAYMENT_CATEGORIES = [
  { key: "advance", label: "Advance payments" },
  { key: "job", label: "Job payments" },
  { key: "weekly", label: "Weekly payments" },
];

export default function MukkadamCard({ clusterId, deployed }) {
  const [mukkadam, setMukkadam] = useState(undefined); // undefined = loading
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setMukkadam(undefined);
    api
      .getClusterMukkadam(clusterId)
      .then((res) => setMukkadam(res.mukkadam || null))
      .catch(() => setMukkadam(null));
  }, [clusterId]);

  if (mukkadam === undefined) return null; // loading — nothing to show yet
  if (!mukkadam) {
    // Before deploy, no mukkadam yet is just "not set up" — normal, hide
    // the card. After deploy, it's worth flagging.
    if (!deployed) return null;
    return (
      <div className="info-card">
        <div className="info-card__title">Mukkadam</div>
        <p className="muted" style={{ color: "var(--color-fail)" }}>
          ⚠ No mukkadam assigned yet.
        </p>
      </div>
    );
  }
  const payments = mukkadam.payments || {};
  const categoriesWithData = PAYMENT_CATEGORIES.map((c) => ({
    ...c,
    items: payments[c.key] || [],
    total: (payments[c.key] || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
  }));
  const grandTotal = categoriesWithData.reduce((sum, c) => sum + c.total, 0);
  const totalPaymentCount = categoriesWithData.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div className="info-card">
      <div className="info-card__title">Mukkadam</div>
      <div className="mukkadam-summary">
        <div>
          <strong>{mukkadam.mukkadam_name}</strong>
          <div className="muted">
            {mukkadam.mobile_numbers || "no phone on file"} • Crew of {mukkadam.crew_size ?? "—"}
          </div>
        </div>
        {totalPaymentCount > 0 && (
          <div className="mukkadam-summary__advance">
            <div className="stat-box__value" style={{ fontSize: 16 }}>
              {formatCurrency(grandTotal)}
            </div>
            <div className="stat-box__label">Total paid</div>
          </div>
        )}
      </div>

      {totalPaymentCount > 0 && (
        <>
          <button className="btn" style={{ marginTop: 10 }} onClick={() => setShowDetails((v) => !v)}>
            {showDetails ? "Hide" : "Show"} full details
          </button>

          {showDetails &&
            categoriesWithData
              .filter((c) => c.items.length > 0)
              .map((c) => (
                <div key={c.key} style={{ marginTop: 14 }}>
                  <div className="muted" style={{ marginBottom: 4 }}>
                    {c.label} ({c.items.length}) — {formatCurrency(c.total)}
                  </div>
                  {c.items.map((p) => (
                    <div className="payment-item" key={p.id}>
                      <span
                        className={`checklist-dot ${p.status === "completed" ? "checklist-dot--pass" : "checklist-dot--fail"}`}
                        title={p.status}
                      />
                      <span>{formatCurrency(p.amount)}</span>
                      <span className="muted">{p.payment_mode?.replace(/_/g, " ")}</span>
                      <span className="muted">{p.payment_date || "date pending"}</span>
                    </div>
                  ))}
                </div>
              ))}
        </>
      )}
    </div>
  );
}