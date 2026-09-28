// src/components/MukkadamCard.jsx
//
// "Money out" side of the cluster's cash flow — sits beside ClusterVault
// ("money in" from farmers) in the cash-flow row, deliberately styled to
// match it (same .info-card title-row-with-total header, same
// .vault-farmer expandable-row pattern) so profit — vault total minus
// this card's cluster mukkadam payout total — reads at a glance across
// the two cards sitting side by side, rather than requiring a scroll to
// a separate section.
//
// Built on the mukkadam integration API's Farmer -> Mukkadam Payouts
// endpoint (reference/am_integration_docs.md §11) — the `payouts` prop is
// useClusterMukkadamPayouts's result, re-grouped by mukkadam_id: one row
// per mukkadam who did completed work for any of this cluster's farmers
// this season, expandable to see exactly which farmer/plot/activity it
// was for. The cluster's assigned head_mukkadam (contact info) is still
// fetched here directly and shown as a secondary identity line, since
// "who do I call" is still useful — but it's no longer the card's
// headline figure.
//
// The old Payments/Ledger tabs (the head_mukkadam's own advance/job/
// weekly payment history, from a different endpoint) are commented out
// below rather than deleted — superseded by the cluster-wide payout view
// above, but kept in case that per-contact payment history is wanted
// back later. Re-enable by uncommenting the imports/helpers/state/JSX.

import { useEffect, useState } from "react";
// import { usePostHog } from "@posthog/react";
import { api } from "../api/client";
// import { mukkadamIntegrationApi } from "../api/mukkadamIntegrationClient";
import { formatCurrency } from "../utils/format";
// import { useCountdown } from "../hooks/useCountdown";
// import { track } from "../analytics/track";
// import Tooltip from "./Tooltip";
import MukkadamPayoutRow from "./mukkadams/MukkadamPayoutRow";

// --- Ledger tab (commented out — see file header) -------------------
//
// const PAYMENT_CATEGORIES = [
//   { key: "advance", label: "Advance payments" },
//   { key: "job", label: "Job payments" },
//   { key: "weekly", label: "Weekly payments" },
// ];
//
// function formatLabel(value) {
//   if (!value) return "";
//   return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
// }
//
// function formatLedgerDate(iso) {
//   if (!iso) return "—";
//   const d = new Date(iso);
//   if (Number.isNaN(d.getTime())) return iso;
//   return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
// }
//
// // Live "time until matured" tag — only shown for entries still maturing,
// // recomputed from wall-clock time rather than trusting a stale API snapshot.
// function MaturingTag({ maturesAt }) {
//   const countdown = useCountdown(maturesAt);
//   return <span className="ledger-tag ledger-tag--maturing">⏳ {countdown || "maturing"}</span>;
// }
//
// function MukkadamLedgerPanel({ ledger, loading, error }) {
//   if (loading) return <p className="muted ledger-loading">Loading ledger…</p>;
//   if (error) return <p className="error-text">Could not load ledger: {error}</p>;
//   if (!ledger || ledger.length === 0) return <p className="muted">No ledger entries yet.</p>;
//
//   const recent = [...ledger].reverse();
//
//   return (
//     <div className="ledger-scroll">
//       {recent.map((entry) => {
//         const isCredit = entry.type === "CREDIT";
//         return (
//           <Tooltip
//             key={entry.id}
//             as="div"
//             className="ledger-row"
//             content={entry.description || formatLabel(entry.entry_type)}
//           >
//             <span className={`ledger-row__amount ledger-row__amount--${isCredit ? "credit" : "debit"}`}>
//               {isCredit ? "↑" : "↓"} {formatCurrency(entry.amount)}
//             </span>
//             <span className="ledger-row__type">
//               {entry.state === "maturing" && entry.matures_at && <MaturingTag maturesAt={entry.matures_at} />}
//               {formatLabel(entry.entry_type)}
//             </span>
//             <span className="ledger-row__date muted">{formatLedgerDate(entry.created_at)}</span>
//           </Tooltip>
//         );
//       })}
//     </div>
//   );
// }
// ---------------------------------------------------------------------

// payouts = the useClusterMukkadamPayouts() result, called once by
// ClusterDetailPage (and shared with ClusterFinancialSummary's payout
// deduction) rather than fetched again here.
export default function MukkadamCard({ clusterId, deployed, payouts }) {
  // const posthog = usePostHog();
  const [mukkadam, setMukkadam] = useState(undefined); // undefined = loading
  // const [showDetails, setShowDetails] = useState(false);
  // const [detailsTab, setDetailsTab] = useState("payments");
  // const [ledger, setLedger] = useState(null); // null = not fetched yet
  // const [ledgerLoading, setLedgerLoading] = useState(false);
  // const [ledgerError, setLedgerError] = useState(null);

  useEffect(() => {
    setMukkadam(undefined);
    // setDetailsTab("payments");
    // setLedger(null);
    // setLedgerError(null);
    api
      .getClusterMukkadam(clusterId)
      .then((res) => setMukkadam(res.mukkadam || null))
      .catch(() => setMukkadam(null));
  }, [clusterId]);

  // Lazy-load the ledger the first time its tab is opened, then cache it —
  // avoids an extra API call for the common case of never checking it.
  // useEffect(() => {
  //   if (detailsTab !== "ledger" || !mukkadam?.mukkadam_id || ledger !== null) return;
  //   const controller = new AbortController();
  //   setLedgerLoading(true);
  //   setLedgerError(null);
  //   mukkadamIntegrationApi
  //     .getMukkadamPaymentOverview(mukkadam.mukkadam_id, controller.signal)
  //     .then((data) => setLedger(data.ledger || []))
  //     .catch((err) => {
  //       if (err.name !== "AbortError") setLedgerError(err.message);
  //     })
  //     .finally(() => setLedgerLoading(false));
  //   return () => controller.abort();
  // }, [detailsTab, mukkadam, ledger]);

  const { loading, error, mukkadamGroups, totals, notFoundFarmerIds } = payouts;

  // Before deploy, no completed work exists yet — same "nothing to show"
  // gate the old card used.
  if (!deployed) return null;

  return (
    <div className="info-card">
      <div className="info-card__title-row">
        <div className="info-card__title">Mukkadam payouts</div>
        {!loading && !error && (
          <div style={{ textAlign: "right" }}>
            <div className="stat-box__value" style={{ fontSize: 16 }}>
              {formatCurrency(totals.payout)}
            </div>
            <div className="stat-box__label">Total mukkadam payout</div>
          </div>
        )}
      </div>

      {mukkadam && (
        <div className="muted" style={{ marginBottom: 8 }}>
          Head mukkadam: <strong>{mukkadam.mukkadam_name}</strong>
          {" · "}
          <span className="ph-no-capture">{mukkadam.mobile_numbers || "no phone on file"}</span> • Crew of{" "}
          {mukkadam.crew_size ?? "—"}
        </div>
      )}

      {loading && <p className="muted">Loading payouts…</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && notFoundFarmerIds.length > 0 && (
        <p className="muted" style={{ color: "var(--color-fail)", marginBottom: 8 }}>
          {notFoundFarmerIds.length} farmer id{notFoundFarmerIds.length === 1 ? "" : "s"} didn&apos;t match a known
          farmer.
        </p>
      )}

      {!loading && !error && mukkadamGroups.length === 0 && (
        <p className="muted">No completed mukkadam work for this cluster yet this season.</p>
      )}

      {!loading && !error && mukkadamGroups.length > 0 && (
        <>
          <div className="muted" style={{ marginBottom: 4 }}>
            {totals.mukkadamCount} mukkadam{totals.mukkadamCount === 1 ? "" : "s"} · {totals.allocations} allocation
            {totals.allocations === 1 ? "" : "s"} · {totals.acres.toFixed(2)} ac
          </div>
          {mukkadamGroups.map((g) => (
            <MukkadamPayoutRow key={g.mukkadam_id} group={g} />
          ))}
        </>
      )}

      {/* "Show full details" Payments/Ledger tabs — commented out, see
          file header. The cluster mukkadam payout view above covers this. */}
      {/* {mukkadam && (
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

          {showDetails && (() => {
            const payments = mukkadam.payments || {};
            const categoriesWithData = PAYMENT_CATEGORIES.map((c) => ({
              ...c,
              items: payments[c.key] || [],
              total: (payments[c.key] || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
            }));
            return (
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
            );
          })()}
        </>
      )} */}
    </div>
  );
}
