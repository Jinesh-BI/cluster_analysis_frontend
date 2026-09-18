// src/api/mukkadamIntegrationClient.js
//
// Client for the mukkadam deployment counts/directory integration API
// (see reference/am_integration_docs.md). Lives on the same host as
// tenderClient.js by default, but is otherwise a distinct client: auth is
// a static `Authorization: Bearer <token>` integration credential (not the
// per-user ca_token from api/client.js, and not tied to useAuth()/login
// state — it doesn't rotate on logout), and the response body is plain
// JSON with no {status, message, data} envelope like tenderClient.js uses.

const MUKKADAM_INTEGRATION_BASE_URL =
  import.meta.env.VITE_MUKKADAM_INTEGRATION_BASE_URL ||
  import.meta.env.VITE_TENDER_BASE_URL ||
  "https://tender.bharatintelligence.ai";

function authHeaders() {
  const token = import.meta.env.VITE_MUKKADAM_INTEGRATION_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, { signal } = {}) {
  const res = await fetch(`${MUKKADAM_INTEGRATION_BASE_URL}${path}`, {
    signal,
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// Only appends a param when the caller gave it an explicit value — omitting
// a filter must mean "all", never an empty-string param, since the API
// treats any boolean value other than the literal string "true" as false.
function buildDirectoryQuery({ q, isPermanent, manualStatus, isTenderSigned } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (isPermanent === true || isPermanent === false) {
    params.set("is_permanent", String(isPermanent));
  }
  if (manualStatus) params.set("manual_status", manualStatus);
  if (isTenderSigned === true || isTenderSigned === false) {
    params.set("is_tender_signed", String(isTenderSigned));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// Same "omit means all" rule as buildDirectoryQuery, plus from_date/mukkadam_id.
function buildAllocationsQuery({ fromDate, mukkadamId, isPermanent, isTenderSigned, q } = {}) {
  const params = new URLSearchParams();
  if (fromDate) params.set("from_date", fromDate);
  if (mukkadamId !== undefined && mukkadamId !== null) params.set("mukkadam_id", String(mukkadamId));
  if (isPermanent === true || isPermanent === false) {
    params.set("is_permanent", String(isPermanent));
  }
  if (isTenderSigned === true || isTenderSigned === false) {
    params.set("is_tender_signed", String(isTenderSigned));
  }
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const mukkadamIntegrationApi = {
  // Aggregate tile-level counts — no params.
  getMukkadamCounts: (signal) => request("/tender/api/integration/mukkadams/stats-counts/", { signal }),

  // Filterable directory listing. filters: { q, isPermanent, manualStatus, isTenderSigned }.
  getMukkadamDirectory: (filters, signal) =>
    request(`/tender/api/integration/mukkadams/details/${buildDirectoryQuery(filters)}`, { signal }),

  // One mukkadam's current-season payments/ledger/earnings snapshot —
  // backs the mukkadam detail page's header, Payments tab, and Ledger tab.
  getMukkadamPaymentOverview: (mukkadamId, signal) =>
    request(`/tender/api/integration/mukkadams/${mukkadamId}/payment-overview/`, { signal }),

  // Allocations since a cutoff date (server defaults to 2026-08-28 if
  // fromDate is omitted). filters: { fromDate, mukkadamId, isPermanent,
  // isTenderSigned, q }. No server-side filtering by activity_name,
  // work_status, or variety — those are applied client-side over this
  // result set (see AllocationsTable).
  getAllocationsSince: (filters, signal) =>
    request(`/tender/api/integration/allocations/${buildAllocationsQuery(filters)}`, { signal }),
};
