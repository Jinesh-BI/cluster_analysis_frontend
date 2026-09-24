// src/components/MukkadamCard.jsx
//
// Fetches the cluster's mukkadam (labor contractor) from the backend,
// which resolves head_mukkadam against the external tender service.
// Renders nothing if the cluster has no mukkadam assigned, or if the
// lookup failed — this card is a bonus, not a blocker for the rest of
// the page.
//
// "Show full details" reveals a small Payments/Ledger tab strip. Payments
// (default tab) is the original categorized advance/job/weekly list,
// untouched. Ledger is new: fetched lazily (only once the tab is first
// opened, then cached) from the mukkadam integration API's payment-overview
// endpoint — a different API/host than getClusterMukkadam above, scoped by
// mukkadam_id rather than clusterId.

import { useEffect, useState } from "react";
import { usePostHog } from "@posthog/react";
import { api } from "../api/client";
import { mukkadamIntegrationApi } from "../api/mukkadamIntegrationClient";
import { formatCurrency } from "../utils/format";
import { useCountdown } from "../hooks/useCountdown";
import { track } from "../analytics/track";
import Tooltip from "./Tooltip";

const PAYMENT_CATEGORIES = [
  { key: "advance", label: "Advance payments" },
  { key: "job", label: "Job payments" },
  { key: "weekly", label: "Weekly payments" },
];

function formatLabel(value) {
  if (!value) return "";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatLedgerDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// Live "time until matured" tag — only shown for entries still maturing,
// recomputed from wall-clock time rather than trusting a stale API snapshot.
function MaturingTag({ maturesAt }) {
  const countdown = useCountdown(maturesAt);
  return <span className="ledger-tag ledger-tag--maturing">⏳ {countdown || "maturing"}</span>;
}

function MukkadamLedgerPanel({ ledger, loading, error }) {
  if (loading) return <p className="muted ledger-loading">Loading ledger…</p>;
  if (error) return <p className="error-text">Could not load ledger: {error}</p>;
  if (!ledger || ledger.length === 0) return <p className="muted">No ledger entries yet.</p>;

  // Ledger arrives oldest-first (a running-balance statement) — flipped
  // here since a quick-glance card reads better most-recent-first. Full
  // list (no cap) since the list itself now scrolls instead of the card
  // growing to fit every entry.
  const recent = [...ledger].reverse();

  return (
    <div className="ledger-scroll">
      {recent.map((entry) => {
        const isCredit = entry.type === "CREDIT";
        return (
          <Tooltip
            key={entry.id}
            as="div"
            className="ledger-row"
            content={entry.description || formatLabel(entry.entry_type)}
          >
            <span className={`ledger-row__amount ledger-row__amount--${isCredit ? "credit" : "debit"}`}>
              {isCredit ? "↑" : "↓"} {formatCurrency(entry.amount)}
            </span>
            <span className="ledger-row__type">
              {entry.state === "maturing" && entry.matures_at && <MaturingTag maturesAt={entry.matures_at} />}
              {formatLabel(entry.entry_type)}
            </span>
            <span className="ledger-row__date muted">{formatLedgerDate(entry.created_at)}</span>
          </Tooltip>
        );
      })}
    </div>
  );
}

export default function MukkadamCard({ clusterId, deployed }) {
  const posthog = usePostHog();
  const [mukkadam, setMukkadam] = useState(undefined); // undefined = loading
  const [showDetails, setShowDetails] = useState(false);
  const [detailsTab, setDetailsTab] = useState("payments");
  const [ledger, setLedger] = useState(null); // null = not fetched yet
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState(null);

  useEffect(() => {
    setMukkadam(undefined);
    setDetailsTab("payments");
    setLedger(null);
    setLedgerError(null);
    api
      .getClusterMukkadam(clusterId)
      .then((res) => setMukkadam(res.mukkadam || null))
      .catch(() => setMukkadam(null));
  }, [clusterId]);

  // Lazy-load the ledger the first time its tab is opened, then cache it —
  // avoids an extra API call for the common case of never checking it.
  useEffect(() => {
    if (detailsTab !== "ledger" || !mukkadam?.mukkadam_id || ledger !== null) return;
    const controller = new AbortController();
    setLedgerLoading(true);
    setLedgerError(null);
    mukkadamIntegrationApi
      .getMukkadamPaymentOverview(mukkadam.mukkadam_id, controller.signal)
      .then((data) => setLedger(data.ledger || []))
      .catch((err) => {
        if (err.name !== "AbortError") setLedgerError(err.message);
      })
      .finally(() => setLedgerLoading(false));
    return () => controller.abort();
  }, [detailsTab, mukkadam, ledger]);

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
            <span className="ph-no-capture">{mukkadam.mobile_numbers || "no phone on file"}</span> • Crew of {mukkadam.crew_size ?? "—"}
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
          <button
            className="btn"
            style={{ marginTop: 10 }}
            onClick={() => {
              track(posthog, "mukkadam_card_details_toggled", { mukkadam_id: mukkadam.mukkadam_id, expanded: !showDetails });
              setShowDetails((v) => !v);
            }}
          >
            {showDetails ? "Hide" : "Show"} full details
          </button>

          {showDetails && (
            <>
              <div className="mukkadam-tabs">
                <button
                  type="button"
                  className={`mukkadam-tab ${detailsTab === "payments" ? "mukkadam-tab--active" : ""}`}
                  onClick={() => {
                    track(posthog, "mukkadam_card_tab_switched", { mukkadam_id: mukkadam.mukkadam_id, tab: "payments" });
                    setDetailsTab("payments");
                  }}
                >
                  Payments
                </button>
                <button
                  type="button"
                  className={`mukkadam-tab ${detailsTab === "ledger" ? "mukkadam-tab--active" : ""}`}
                  onClick={() => {
                    track(posthog, "mukkadam_card_tab_switched", { mukkadam_id: mukkadam.mukkadam_id, tab: "ledger" });
                    setDetailsTab("ledger");
                  }}
                >
                  Ledger
                </button>
              </div>

              {detailsTab === "payments" &&
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

              {detailsTab === "ledger" && (
                <MukkadamLedgerPanel ledger={ledger} loading={ledgerLoading} error={ledgerError} />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}