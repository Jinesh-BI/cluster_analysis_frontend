// src/components/financials/financialUtils.js
//
// Shared classification for RevenueProfitabilityPage — turns a cluster's
// raw revenue_served/cluster_net into a four-tier read a founder/investor
// can scan in one glance, rather than just a signed number:
//   no revenue yet -> nothing served this season, profit/loss is
//                      meaningless until there's a revenue base to compare against.
//   loss           -> net is negative, regardless of margin size.
//   thin margin    -> profitable, but under 10% — a cluster that's
//                      technically fine but has little room for error.
//   healthy margin -> comfortably profitable.
// The 10% cutoff is a starting judgment call, not a figure from the API
// — flagged here as the one place to move it if the real threshold differs.
import { formatCurrency } from "../../utils/format";

const THIN_MARGIN_CUTOFF_PCT = 10;

export const CLUSTER_STATUS = {
  no_revenue: { label: "No revenue yet", color: "default" },
  loss: { label: "Loss", color: "error" },
  thin: { label: "Thin margin", color: "warning" },
  healthy: { label: "Healthy margin", color: "success" },
};

export function marginPercent(net, revenueServed) {
  if (!revenueServed) return null;
  return (net / revenueServed) * 100;
}

export function clusterFinancialStatus(net, revenueServed) {
  const margin = marginPercent(net, revenueServed);
  if (margin === null) return { key: "no_revenue", margin, ...CLUSTER_STATUS.no_revenue };
  if (net < 0) return { key: "loss", margin, ...CLUSTER_STATUS.loss };
  if (margin < THIN_MARGIN_CUTOFF_PCT) return { key: "thin", margin, ...CLUSTER_STATUS.thin };
  return { key: "healthy", margin, ...CLUSTER_STATUS.healthy };
}

export function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

// A mukkadam's earned-vs-withdrawn gap can go negative (a payment this
// season settling work earned in a *prior* season — reference doc §13 is
// explicit these are two independent totals, not a running balance), so
// this is a three-way read, not just "owed or not": still owed (warning),
// settled ahead from an earlier season (neutral, not a problem), or
// exactly settled.
export function outstandingMeta(outstanding) {
  if (outstanding > 0) return { label: `Owed ${formatCurrency(outstanding)}`, color: "warning.main" };
  if (outstanding < 0) return { label: `Prior-season ${formatCurrency(Math.abs(outstanding))}`, color: "text.secondary" };
  return { label: "Settled", color: "text.disabled" };
}
