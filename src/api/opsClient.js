// src/api/opsClient.js
//
// Client for backend endpoints served directly off ops.bharatintelligence.ai
// (no /plot-analysis prefix), unlike api/client.js's API_BASE. Same auth
// token and error envelope as api/client.js, so this stays a thin sibling
// rather than a rewrite.

const OPS_BASE_URL =
  import.meta.env.VITE_OPS_BASE_URL || "https://ops.bharatintelligence.ai";

function authHeaders() {
  const token = localStorage.getItem("ca_token");
  return token ? { Authorization: `Token ${token}` } : {};
}

async function request(path, options = {}) {
  const res = await fetch(`${OPS_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.detail || body.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}
export const opsApi = {
  // Per-farmer September payment-coverage check — vault balance vs. upcoming
  // activity costs, walked in date order (reference/farmer_activity_coverage_api.md).
  // 404 means no active (non-cancelled) September booking for this farmer —
  // a normal/expected state, not an error.
  getFarmerActivityCoverage: (farmerId) =>
    request(`/payment-schedule/coverage/${farmerId}/`),

  // Bypasses a ledger entry's normal 24h maturity window and releases it
  // immediately — a real mutation (unlike the read-only mukkadam
  // integration API), so it requires a reason for the audit trail.
  // payload: { mukkadam_id, ledger_id, reason }
  releaseLedgerEntryEarly: (payload) =>
    request(`/plot-analysis/tender/release-ledger-entry-early/`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
