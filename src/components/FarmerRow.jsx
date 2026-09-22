// src/components/FarmerRow.jsx
import { useState } from "react";
import { api } from "../api/client";
import { formatCurrency } from "../utils/format";

function coveragePill(coverage) {
  if (!coverage || coverage.status !== "ok") return null;
  const { has_shortage, activities_covered, upcoming_activities_total } = coverage.data;
  if (!has_shortage) return <span className="status-pill status-pill--paid">✓ Funded</span>;
  const cls = activities_covered === 0 ? "status-pill--overdue" : "status-pill--pending";
  return (
    <span className={`status-pill ${cls}`}>
      ⚠ {activities_covered}/{upcoming_activities_total} covered
    </span>
  );
}

export default function FarmerRow({ clusterId, farmer, coverage }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [activities, setActivities] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (data) return; // already fetched once, don't refetch on every toggle

    setLoading(true);
    setError(null);
    try {
      const [payments, bookedActivities] = await Promise.all([
        api.getFarmerPayments(clusterId, farmer.farmer_id),
        api.getFarmerActivities(clusterId, farmer.farmer_id),
      ]);
      setData(payments);
      setActivities(bookedActivities);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function statusPillClass(status) {
    if (status === "COMPLETED") return "status-pill--paid";
    if (status === "CANCELLED" || status === "NOT_STARTED") return "status-pill--booked";
    return "status-pill--partial";
  }

  return (
    <li className="farmer-row">
      <button className="farmer-row__toggle" onClick={toggle}>
        <span>
          {farmer.farmer_name} — {farmer.phone_number || "no phone on file"}
          <span className="muted">
            {" • "}
            {farmer.plot_count} {farmer.plot_count === 1 ? "plot" : "plots"} •{" "}
            {farmer.activity_count} {farmer.activity_count === 1 ? "activity" : "activities"}
          </span>
        </span>
        <span className="farmer-row__metrics">
          {coveragePill(coverage)}
          <span className="farmer-row__caret">{open ? "\u25B2" : "\u25BC"}</span>
        </span>
      </button>

      {open && (
        <div className="farmer-row__detail">
          {coverage?.status === "ok" && (
            <div className="coverage-block">
              <div className="muted">
                Vault balance {formatCurrency(coverage.data.vault_balance)} — covers{" "}
                {coverage.data.activities_covered}/{coverage.data.upcoming_activities_total} upcoming activities
                {coverage.data.has_shortage && (
                  <span style={{ color: "var(--color-fail)" }}> — hold off on the activities marked below</span>
                )}
              </div>
              <div className="checklist">
                {coverage.data.activities.map((a) => (
                  <div
                    className="checklist-row"
                    key={a.activity_id}
                    title={
                      a.covered
                        ? "Vault balance covers this"
                        : "Vault balance runs out before this activity — consider not scheduling yet"
                    }
                  >
                    <span className={`checklist-dot ${a.covered ? "checklist-dot--pass" : "checklist-dot--fail"}`} />
                    <span>
                      {a.activity_name} — {formatCurrency(a.cost)}{" "}
                      {a.date_time ? `(${a.date_time.slice(0, 10)})` : "(unscheduled)"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {coverage?.status === "no-booking" && (
            <p className="muted">No active September booking — payment coverage check not applicable.</p>
          )}
          {coverage?.status === "error" && (
            <p className="error-text">Coverage check failed: {coverage.message}</p>
          )}
          {coverage === undefined && <p className="muted">Checking payment coverage…</p>}

          {loading && <p className="muted">Loading payment activity…</p>}
          {error && <p className="error-text">{error}</p>}

          {data && !data.booking && (
            <p className="muted">No matching booking found for this cluster&apos;s season.</p>
          )}

          {data?.booking && (
            <div className="booking-summary">
              <span>Gross {formatCurrency(data.booking.gross_amount)}</span>
              <span>Advance {formatCurrency(data.booking.advance_paid)}</span>
              <span>Balance {formatCurrency(data.booking.balance)}</span>
              <span className={`status-pill status-pill--${(data.booking.status || "").toLowerCase()}`}>
                {data.booking.status}
              </span>
            </div>
          )}

          {data?.booking && data.payments.length === 0 && (
            <p className="muted">No individual payments recorded yet.</p>
          )}

          {data?.payments?.map((p) => (
            <div className="payment-item" key={p.id}>
              <span
                className={`checklist-dot ${p.paid_status ? "checklist-dot--pass" : "checklist-dot--fail"}`}
                title={p.paid_status ? "Confirmed" : "Unconfirmed"}
              />
              <span>{formatCurrency(p.amount)}</span>
              <span className="muted">{p.mode}</span>
              <span className="muted">{p.paid_at ? p.paid_at.slice(0, 10) : "date pending"}</span>
            </div>
          ))}

          {activities?.length > 0 && (
            <>
              <div className="muted" style={{ marginTop: 10, marginBottom: 4 }}>
                Booked activities ({activities.length})
              </div>
              {activities.map((a) => (
                <div className="payment-item" key={a.activity_id}>
                  <span>{a.activity_name}</span>
                  <span className="muted">Plot {a.plot_id || "—"}</span>
                  <span className={`status-pill ${statusPillClass(a.status)}`}>{a.status}</span>
                  <span className="muted">{a.date || "no date yet"}</span>
                </div>
              ))}
            </>
          )}
          {activities?.length === 0 && (
            <p className="muted" style={{ marginTop: 10 }}>No booked activities found for this cluster&apos;s season.</p>
          )}
        </div>
      )}
    </li>
  );
}