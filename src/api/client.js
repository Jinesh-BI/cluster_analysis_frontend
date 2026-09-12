// src/api/client.js
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://ops.bharatintelligence.ai/plot-analysis";
  // "http://localhost:8000/plot-analysis";

function authHeaders() {
  const token = localStorage.getItem("ca_token");
  return token ? { Authorization: `Token ${token}` } : {};
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  login: (username, password) =>
    request("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  // omId narrows the list to clusters delegated to that one OM —
  // Admin/AM only, see the dropdown on ClusterListPage. Omit for the
  // normal "everything I can see" list.
  getClusters: (omId) =>
    request(omId ? `/clusters/?om_id=${omId}` : "/clusters/"),
  getCluster: (id) => request(`/clusters/${id}/`),
  deployCluster: (id) => request(`/clusters/${id}/deploy/`, { method: "POST" }),

  // "Today / Tomorrow" activities section on the Cluster List page —
  // every cluster the current user can see with something going on that
  // day, grouped by cluster. day is "YYYY-MM-DD"; omit for today.
  // NOTE: this hits /clusters/activity-today/, NOT /clusters/today/ —
  // the latter is a separate, API-key-only endpoint for an external
  // dashboard service and isn't reachable with a manager login.
  getClustersActiveOn: (day) =>
    request(
      day
        ? `/clusters/activity-today/?day=${day}`
        : `/clusters/activity-today/`,
    ),
  getCalendar: (id) => request(`/clusters/${id}/calendar/`),
  getCalendarDay: (id, day) => request(`/clusters/${id}/calendar/${day}/`),
  getFarmerPayments: (id, farmerId) =>
    request(`/clusters/${id}/farmers/${farmerId}/payments/`),
  getFarmerActivities: (id, farmerId) =>
    request(`/clusters/${id}/farmers/${farmerId}/activities/`),
  assignCluster: (id, assistantManagerId) =>
    request(`/clusters/${id}/assign/`, {
      method: "POST",
      body: JSON.stringify({ assistant_manager_id: assistantManagerId }),
    }),

  // Planning playground — blocks are read-only (every activity in the
  // cluster). Splitting/placing happens locally; getClusterSchedule /
  // saveClusterSchedule are the actual persistence for a plan.
  getClusterPlayground: (id) => request(`/clusters/${id}/playground/`),
  getClusterSchedule: (id) => request(`/clusters/${id}/schedule/`),
  saveClusterSchedule: (id, data) =>
    request(`/clusters/${id}/schedule/`, {
      method: "POST",
      body: JSON.stringify({ data }),
    }),

  // Sends the already-saved ClusterSchedule to the external calendar
  // service. No body — the backend publishes whatever's currently
  // saved, so this can never publish something different from what
  // Save persisted.
  publishClusterSchedule: (id) =>
    request(`/clusters/${id}/publish/`, { method: "POST" }),

  // Labor contact for the cluster, sourced from the external mukkadam
  // service — read-only, resolved server-side from head_mukkadam.
  getClusterMukkadam: (id) => request(`/clusters/${id}/mukkadam/`),

  // Every mukkadam currently active in the field (not scoped to a
  // cluster) — the roster the allocation picker searches, including
  // crews currently deployed on a different cluster. Server caches
  // this briefly, so it's cheap to call on every picker open.
  getDeployedMukkadams: () => request(`/clusters/mukkadams-deployed/`),

  // Global per-mukkadam attendance for a day — same number regardless
  // of which cluster/job the mukkadam is working that day.
  getMukkadamAttendance: (day) => request(`/clusters/mukkadam-attendance/?date=${day}`),

  // payload: { mukkadam_id, mukkadam_name, date, count }
  setMukkadamAttendance: (payload) =>
    request(`/clusters/mukkadam-attendance/`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Shed survey progress + shed ratings/remarks/photos + kit summary
  // for the cluster — read-only rollup across shed_assignment,
  // shed_management, and this app's own FieldKit.
  getClusterSheds: (id) => request(`/clusters/${id}/sheds/`),

  // Farmer vault balances + transactions for the cluster — resolved
  // server-side from the farmer app's own vault ledger.
  getClusterVault: (id) => request(`/clusters/${id}/vault/`),

  // Cluster operating spend (shed, travel, essentials, etc.) —
  // separate from farmer bookings/payments.
  getClusterCosts: (id) => request(`/clusters/${id}/costs/`),

  // payload: { activity_id, piece_date, mukkadam_id, mukkadam_name, percent }
  allocateMukkadam: (clusterId, payload) =>
    request(`/clusters/${clusterId}/mukkadam-allocations/`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  unassignMukkadam: (clusterId, allocationId) =>
    request(`/clusters/${clusterId}/mukkadam-allocations/${allocationId}/unassign/`, {
      method: "POST",
    }),
  createClusterCost: (id, payload) =>
    request(`/clusters/${id}/costs/`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getClusterHolidays: (id) => request(`/clusters/${id}/holidays/`),
  addClusterHoliday: (id, payload) =>
    request(`/clusters/${id}/holidays/`, { method: "POST", body: JSON.stringify(payload) }),
  getGlobalHolidays: () => request("/managers/holidays/"),
  addGlobalHoliday: (payload) =>
    request("/managers/holidays/", { method: "POST", body: JSON.stringify(payload) }),

  getManagers: () => request("/managers/"),
  createManager: (payload) =>
    request("/managers/", { method: "POST", body: JSON.stringify(payload) }),
  // Regional-Manager-only: of their assigned clusters, how many are
  // further delegated to an OMs, and to whom.
  getManagerOverview: () => request("/managers/overview/"),
};
