// src/api/tenderClient.js
//
// Client for the tender service's public ops endpoints — a different host
// than api/client.js's ops.bharatintelligence.ai, with no auth token and
// its own success/error envelope ({ status, message, data }), so it gets
// its own thin request wrapper instead of reusing api/client.js's request().

const TENDER_BASE_URL =
  import.meta.env.VITE_TENDER_BASE_URL || "https://tender.bharatintelligence.ai";

async function request(path, { signal } = {}) {
  const res = await fetch(`${TENDER_BASE_URL}${path}`, { signal });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.status !== "success") {
    throw new Error(body?.message || `Request failed (${res.status})`);
  }
  return body.data;
}

export const tenderApi = {
  // Every mukkadam job/allocation reported for a "YYYY-MM-DD" date —
  // { date, count, results }. Backs the Mukkadam Job Board widget.
  getMukkadamJobs: (dateStr, signal) =>
    request(`/ops/mukkadams/jobs/?date=${dateStr}`, { signal }),
};
