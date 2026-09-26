// src/pages/ClusterDetailPage.jsx
import { useEffect, useMemo, useState } from "react";
import { usePostHog } from "@posthog/react";
import { useParams, Link } from "react-router-dom";
import { analyticsLogger } from "../analytics/logger";
import { track, trackException, trackGroup } from "../analytics/track";
import { api } from "../api/client";
import { opsApi } from "../api/opsClient";
import Calendar from "../components/Calendar";
import ClusterActivityToday from "../components/ClusterActivityToday";
import DayDetailPanel from "../components/DayDetailPanel";
import FarmerRow from "../components/FarmerRow";
import MukkadamCard from "../components/MukkadamCard";
import ShedCard from "../components/ShedCard";
import ClusterVault from "../components/ClusterVault";
import FillRateDetail from "../components/FillRateDetail";
import ClusterCosts from "../components/ClusterCosts";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../utils/format";
import { holidayDateMap } from "../utils/dates";

// A bit bigger than the original dot-grid size (12px), so the calendar
// reads clearly as a calendar rather than a strip of dots.
const CALENDAR_CELL_SIZE = 20;

// Graduated urgency for the Payment coverage table, keyed off how many
// upcoming activities a farmer's vault can already fund (not the deficit) —
// 0 covered means nothing can proceed without a call; a handful covered is
// just a heads-up for the farmer; several covered is barely worth a glance.
function coverageSeverity(covered) {
  if (covered === 0) {
    return {
      label: "Critical",
      tagClass: "erp-tag--danger",
      note: "Call the farmer — funds must be collected before any activity can proceed",
    };
  }
  if (covered <= 2) {
    return {
      label: "Manageable",
      tagClass: "erp-tag--warning",
      note: `Give the farmer advance notice — only ${covered} activit${covered === 1 ? "y" : "ies"} can be funded right now`,
    };
  }
  if (covered <= 4) {
    return {
      label: "Good",
      tagClass: "erp-tag--info",
      note: "Most activities are already funded — just keep an eye on it",
    };
  }
  return {
    label: "Low priority",
    tagClass: "erp-tag--neutral",
    note: "No action needed",
  };
}

export default function ClusterDetailPage() {
  const posthog = usePostHog();
  const { id } = useParams();
  const { isManagerTier, user } = useAuth();

  const [cluster, setCluster] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayActivities, setDayActivities] = useState(null);
  const [showAllFarmers, setShowAllFarmers] = useState(false);
  const [managers, setManagers] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [assignedTo, setAssignedTo] = useState(null);
  const [deploying, setDeploying] = useState(false);
  const [holidays, setHolidays] = useState(null);
  const [holidayForm, setHolidayForm] = useState({ label: "", start_date: "", end_date: "" });
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [error, setError] = useState(null);
  const [coverageByFarmer, setCoverageByFarmer] = useState({});
  const [focusRequest, setFocusRequest] = useState(null); // { farmerId, token }

  useEffect(() => {
    setCluster(null);
    setCalendar(null);
    setHolidays(null);
    api.getCluster(id).then(setCluster).catch((e) => setError(e.message));
    api.getCalendar(id).then(setCalendar).catch((e) => setError(e.message));
    api.getClusterHolidays(id).then(setHolidays).catch((e) => setError(e.message));
  }, [id]);

  async function handleAddHoliday(e) {
    e.preventDefault();
    setSavingHoliday(true);
    setError(null);
    try {
      await api.addClusterHoliday(id, holidayForm);
      track(posthog, "cluster_holiday_added", {
        cluster_id: id,
        actor_role: user?.role,
        spans_multiple_days: holidayForm.start_date !== holidayForm.end_date,
      });
      setHolidayForm({ label: "", start_date: "", end_date: "" });
      setShowHolidayForm(false);
      api.getClusterHolidays(id).then(setHolidays).catch((e) => setError(e.message));
    } catch (e) {
      trackException(posthog, e);
      track(posthog, "cluster_holiday_add_failed", { cluster_id: id });
      setError(e.message);
    } finally {
      setSavingHoliday(false);
    }
  }

  useEffect(() => {
    if (!selectedDay) return;
    setDayActivities(null);
    api
      .getCalendarDay(id, selectedDay)
      .then(setDayActivities)
      .catch((e) => setError(e.message));
  }, [id, selectedDay]);

  // Payment-coverage check is per-farmer only (no bulk endpoint), so this
  // fans out one request per farmer as soon as the cluster loads. Each
  // farmer's outcome is handled independently — one failure never blocks
  // the others or trips the page-level error state.
  useEffect(() => {
    setCoverageByFarmer({});
    if (!cluster?.farmers?.length) return;
    cluster.farmers.forEach((f) => {
      opsApi
        .getFarmerActivityCoverage(f.farmer_id)
        .then((data) =>
          setCoverageByFarmer((prev) => ({ ...prev, [f.farmer_id]: { status: "ok", data } }))
        )
        .catch((e) =>
          setCoverageByFarmer((prev) => ({
            ...prev,
            [f.farmer_id]: { status: e.status === 404 ? "no-booking" : "error", message: e.message },
          }))
        );
    });
  }, [id, cluster?.farmer_count]);

  // Only farmers actually at risk are decision-relevant here — a manager
  // needs to know who and which activities, not a headcount of the
  // unremarkable "fully funded" majority.
  const atRiskFarmers = useMemo(() => {
    if (!cluster?.farmers) return [];
    return cluster.farmers
      .map((f) => ({ farmer: f, coverage: coverageByFarmer[f.farmer_id] }))
      .filter(({ coverage }) => coverage?.status === "ok" && coverage.data.has_shortage)
      .sort((a, b) => a.coverage.data.activities_covered - b.coverage.data.activities_covered);
  }, [cluster?.farmers, coverageByFarmer]);

  const coverageStats = useMemo(() => {
    const entries = Object.values(coverageByFarmer);
    const uncoveredActivities = atRiskFarmers.reduce(
      (sum, { coverage }) =>
        sum + (coverage.data.upcoming_activities_total - coverage.data.activities_covered),
      0
    );
    return {
      checked: entries.length,
      total: cluster?.farmers?.length || 0,
      atRisk: atRiskFarmers.length,
      uncoveredActivities,
    };
  }, [coverageByFarmer, cluster?.farmers?.length, atRiskFarmers]);

  const calendarDayMap = useMemo(() => {
    const map = {};
    for (const d of calendar?.days || []) {
      map[d.date] = { count: d.activity_count, intensity: d.intensity, allCompleted: d.all_completed };
    }
    return map;
  }, [calendar]);

  // Layers holiday brackets on top of the activity heatmap — a day can
  // have both activities AND be a holiday, so this doesn't replace
  // calendarDayMap, it merges with it.
  const holidayMap = useMemo(
    () => holidayDateMap([...(holidays?.global || []), ...(holidays?.cluster || [])]),
    [holidays]
  );
  function getDayDataWithHolidays(date) {
    const base = calendarDayMap[date];
    const holidayLabel = holidayMap[date];
    if (!base && !holidayLabel) return undefined;
    return { ...(base || {}), isHoliday: Boolean(holidayLabel), holidayLabel };
  }

  // Jumps to a farmer's row in the Farmers list below and expands it —
  // used by the Payment coverage card so a manager can act on a flagged
  // farmer without hunting through the full list themselves.
  function focusFarmer(farmerId) {
    setShowAllFarmers(true); // the farmer may be past the default slice(0, 6)
    setFocusRequest({ farmerId, token: Date.now() });
  }

  function loadManagers() {
    if (managers) {
      setManagers(null); // toggle closed
      return;
    }
    api.getManagers().then(setManagers).catch((e) => setError(e.message));
  }

  async function handleDeploy() {
    setDeploying(true);
    setError(null);
    try {
      const updated = await api.deployCluster(id);
      trackGroup(posthog, "cluster", id, {
        name: updated.name,
        farmer_count: updated.farmer_count,
        total_acres: updated.total_acres,
      });
      track(posthog, "cluster_started", {
        cluster_id: id,
        actor_role: user?.role,
        farmer_count: updated.farmer_count,
        total_acres: updated.total_acres,
      });
      analyticsLogger.info("cluster deployment completed", {
        outcome: "success",
        cluster_id: id,
        farmer_count: updated.farmer_count,
      });
      setCluster(updated);
    } catch (e) {
      trackException(posthog, e);
      analyticsLogger.error("cluster deployment completed", {
        outcome: "failure",
        cluster_id: id,
        error_type: e?.name || "Error",
      });
      setError(e.message);
    } finally {
      setDeploying(false);
    }
  }

  async function handleAssign(manager) {
    setAssigning(true);
    setError(null);
    try {
      await api.assignCluster(id, manager.id);
      track(posthog, "cluster_assigned", {
        cluster_id: id,
        manager_id: manager.id,
        actor_role: user?.role,
      });
      setAssignedTo(manager.username);
      setManagers(null);
      // Refetch so the "currently assigned to" chain below reflects
      // this assignment immediately, not just on next page load.
      api.getCluster(id).then(setCluster).catch((e) => setError(e.message));
    } catch (e) {
      trackException(posthog, e);
      track(posthog, "cluster_assign_failed", { cluster_id: id });
      setError(e.message);
    } finally {
      setAssigning(false);
    }
  }

  if (error) {
    return (
      <div className="page">
        <p className="error-text">{error}</p>
      </div>
    );
  }
  if (!cluster) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  const visibleFarmers = showAllFarmers ? cluster.farmers : cluster.farmers.slice(0, 6);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/" className="btn" style={{ marginBottom: 8, display: "inline-block" }}>
            ← Back
          </Link>
          <h1>{cluster.name}</h1>
          <div className="cluster-card__meta">
            {cluster.season} {cluster.year}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {cluster.deployed ? (
            <span className="status-pill status-pill--paid">Deployed</span>
          ) : (
            <button className="btn btn-primary" onClick={handleDeploy} disabled={deploying}>
              {deploying ? "Starting…" : "Start cluster"}
            </button>
          )}
          {isManagerTier && (
            <button className="btn" onClick={loadManagers}>
              {managers ? "Cancel" : "Assign to…"}
            </button>
          )}
        </div>
      </div>

      <div className="cluster-card__meta" style={{ marginBottom: 12 }}>
        Currently assigned —{" "}
        {cluster.assignment_chain?.regional_manager
          ? `Area Manager (AM): ${cluster.assignment_chain.regional_manager.username}`
          : "no AM assigned"}
        {" · "}
        {cluster.assignment_chain?.assistant_manager
          ? `Operations Manager (OM): ${cluster.assignment_chain.assistant_manager.username}`
          : "not yet delegated to an OM"}
      </div>

      {assignedTo && <p className="muted">Assigned to {assignedTo}.</p>}

      <div className="stat-row">
        <div className="stat-box">
          <div className="stat-box__value">{cluster.farmer_count}</div>
          <div className="stat-box__label">Farmers</div>
        </div>
        <div className="stat-box">
          <div className="stat-box__value">{cluster.total_acres}</div>
          <div className="stat-box__label">Total acres</div>
        </div>
        <div className="stat-box">
          <div className="stat-box__value">{cluster.total_plots}</div>
          <div className="stat-box__label">Total plots</div>
        </div>
        <div className="stat-box">
          <div className="stat-box__value">{cluster.active_plots}</div>
          <div className="stat-box__label">Active plots</div>
        </div>
        <div className="stat-box">
          <div className="stat-box__value">{cluster.total_activities}</div>
          <div className="stat-box__label">Total activities</div>
        </div>
        <FillRateDetail calendar={calendar} />
        <div className="stat-box">
          <div className="stat-box__value">{formatCurrency(cluster.total_value)}</div>
          <div className="stat-box__label">Cluster value</div>
        </div>
      </div>

      <div className="checklist" style={{ marginBottom: 24 }}>
        {cluster.checklist.map((item) => {
          const missing = (item.failed_farmers || [])
            .map((f) => (f.plot_ids?.length ? `${f.farmer_name} (plot ${f.plot_ids.join(", ")})` : f.farmer_name))
            .join(", ");
          return (
            <div className="checklist-row" key={item.key} title={missing || undefined}>
              <span
                className={`checklist-dot ${item.passed ? "checklist-dot--pass" : "checklist-dot--fail"}`}
              />
              <span>
                {item.label} — {item.passed_count}/{item.total_count}
              </span>
            </div>
          );
        })}
      </div>

      <ClusterActivityToday clusterId={id} />

      <h3 style={{ marginTop: 8 }}>Upcoming activities</h3>
      {cluster.upcoming_activities?.length > 0 ? (
        cluster.upcoming_activities.map((a) => (
          <div className="activity-item" key={a.activity_id}>
            <div>
              <strong>{a.activity_name}</strong> — {a.date}
            </div>
            <div className="muted">
              {a.farmer_id} • Plot {a.plot_id || "—"}
              {a.variety ? ` (${a.variety})` : ""}
              {a.crop ? ` • ${a.crop}` : ""}
            </div>
          </div>
        ))
      ) : (
        <p className="muted">Nothing coming up.</p>
      )}

      <div className="erp-card" style={{ marginTop: 20 }}>
        
  {/* ERP Header Row with System Metadata */}
  <div className="erp-card__header">
    <div className="erp-card__title-group">
      <h3 className="erp-card__title">Payment Coverage & Vault Audit</h3>
    </div>

    {coverageStats.checked > 0 && (
      <div className="erp-card__status-container">
        {coverageStats.atRisk > 0 ? (
          <div className="erp-status-badge erp-status-badge--critical">
            <span className="erp-indicator-pulse"></span>
            <span>CRITICAL: {coverageStats.atRisk} EXCEPTION(S)</span>
          </div>
        ) : (
          <div className="erp-status-badge erp-status-badge--optimal">
            <span>STATUS: OPTIMAL (100% FUNDED)</span>
          </div>
        )}
      </div>
    )}
  </div>

  {/* Progress Matrix / Data Loading State */}
  {coverageStats.checked < coverageStats.total && (
    <div className="erp-progress-panel">
      <div className="erp-progress-row">
        <span className="erp-data-label">Ledger Sync Progress:</span>
        <span className="erp-data-value">{coverageStats.checked} / {coverageStats.total} Records Processed</span>
      </div>
      <div className="erp-progress-track">
        <div 
          className="erp-progress-fill" 
          style={{ width: `${(coverageStats.checked / coverageStats.total) * 100}%` }}
        ></div>
      </div>
    </div>
  )}

  {/* Exception Data Grid (ERP Table-like Structure) */}
  {atRiskFarmers.length > 0 && (
    <div className="erp-exception-block">
      <div className="erp-alert-strip erp-alert-strip--warning">
        <span className="erp-alert-code">Alert:</span>
        <span className="erp-alert-message">
          Execution halted for <strong>{coverageStats.uncoveredActivities}</strong> pending activities due to insufficient vault liquidity.
        </span>
      </div>

      <div className="erp-data-table-container">
        <div className="erp-table-header">
          <span className="col-farmer">Farmer</span>
          <span className="col-metric">Funding Ratio</span>
          <span className="col-status">Risk Assessment</span>
          <span className="col-action">Next Step</span>
        </div>

        <div className="erp-table-body">
          {atRiskFarmers.map(({ farmer, coverage }) => {
            const covered = coverage.data.activities_covered;
            const total = coverage.data.upcoming_activities_total;
            const percentage = Math.round((covered / total) * 100);
            const severity = coverageSeverity(covered);

            return (
              <div
                key={farmer.farmer_id}
                className="erp-table-row"
                onClick={() => focusFarmer(farmer.farmer_id)}
              >
                <div className="col-farmer">
                  <div className="erp-farmer-meta">
                    <span className="erp-text-bold">{farmer.farmer_name}</span>
                    <span className="erp-recommended-note">{severity.note}</span>
                  </div>
                </div>

                <div className="col-metric">
                  <span className="erp-numeric-stat">{covered} / {total}</span>
                  <span className="erp-sub-stat">({percentage}%)</span>
                </div>

                <div className="col-status">
                  <span className={`erp-inline-tag ${severity.tagClass}`}>{severity.label}</span>
                </div>

                <div className="col-action">
                  <button type="button" className="erp-btn-link">
                    View full details ↓
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  )}

  {/* Optimal System State */}
  {atRiskFarmers.length === 0 && coverageStats.checked > 0 && (
    <div className="erp-empty-panel erp-empty-panel--success">
      <span className="erp-panel-icon">✔</span>
      <div className="erp-panel-text">
        <strong>All Systems Nominal:</strong> Verified {coverageStats.checked} accounts. No liquidity discrepancies identified. Execution queue is unlocked.
      </div>
    </div>
  )}

  {/* Initializing State */}
  {coverageStats.checked === 0 && (
    <div className="erp-empty-panel erp-empty-panel--neutral">
      <span className="erp-panel-spinner">⟳</span>
      <div className="erp-panel-text">
        Querying core banking / vault infrastructure... Please wait.
      </div>
    </div>
  )}
</div>

      <h3 style={{ marginTop: 8 }}>Cash flow</h3>
      <p className="muted">Money in from farmers, next to money out to the mukkadam.</p>
      <div className="cash-flow-row">
        <ClusterVault clusterId={id} deployed={cluster.deployed} />
        <MukkadamCard clusterId={id} deployed={cluster.deployed} />
      </div>

      <ShedCard clusterId={id} />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Activity calendar</h3>
          {!cluster.has_schedule && (
            <span className="status-pill status-pill--pending">No schedule saved yet</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => setShowHolidayForm((v) => !v)}>
            {showHolidayForm ? "Cancel" : "Add holiday"}
          </button>
          <Link
            to={`/clusters/${id}/playground`}
            className="btn btn-primary"
            onClick={() => track(posthog, "cluster_playground_opened", { cluster_id: id, actor_role: user?.role })}
          >
            Open planning playground
          </Link>
        </div>
      </div>

      {showHolidayForm && (
        <form className="form-stack" onSubmit={handleAddHoliday} style={{ marginBottom: 12, maxWidth: 420 }}>
          <input
            className="input"
            placeholder="Label (e.g. Diwali, local event)"
            value={holidayForm.label}
            onChange={(e) => setHolidayForm({ ...holidayForm, label: e.target.value })}
            required
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              type="date"
              value={holidayForm.start_date}
              onChange={(e) => setHolidayForm({ ...holidayForm, start_date: e.target.value })}
              required
            />
            <input
              className="input"
              type="date"
              value={holidayForm.end_date}
              onChange={(e) => setHolidayForm({ ...holidayForm, end_date: e.target.value })}
              required
            />
          </div>
          <button className="btn btn-primary" disabled={savingHoliday}>
            {savingHoliday ? "Saving…" : "Save holiday for this cluster"}
          </button>
        </form>
      )}

      {(holidays?.global?.length > 0 || holidays?.cluster?.length > 0) && (
        <div className="muted" style={{ marginBottom: 8 }}>
          Holidays:{" "}
          {[...(holidays.global || []), ...(holidays.cluster || [])]
            .map((h) => `${h.label} (${h.start_date} – ${h.end_date})`)
            .join(", ")}
        </div>
      )}
      <Calendar
        getDayData={getDayDataWithHolidays}
        activeDate={selectedDay}
        onSelectDay={setSelectedDay}
        cellSize={CALENDAR_CELL_SIZE}
        visibleMonths={4}
      />

      <h3 style={{ marginTop: 28 }}>Costs</h3>
      <ClusterCosts clusterId={id} />

      <h3 style={{ marginTop: 28 }}>Farmers</h3>
      <p className="muted">Tap a farmer to see their payment activity.</p>
      <div className="farmer-list">
        {visibleFarmers.map((f) => (
          <FarmerRow
            key={f.farmer_id}
            clusterId={id}
            farmer={f}
            coverage={coverageByFarmer[f.farmer_id]}
            focusToken={focusRequest?.farmerId === f.farmer_id ? focusRequest.token : null}
          />
        ))}
      </div>
      {cluster.farmers.length > 6 && (
        <button className="btn" onClick={() => setShowAllFarmers((v) => !v)}>
          {showAllFarmers ? "Show fewer" : `Show all ${cluster.farmers.length}`}
        </button>
      )}

      {managers && (
        <div style={{ marginTop: 24 }}>
          <h3>Assign to…</h3>
          {managers.length === 0 && (
            <p className="muted">No one available to assign to yet.</p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {managers.map((m) => (
              <button
                key={m.id}
                className="btn"
                disabled={assigning}
                onClick={() => handleAssign(m)}
              >
                {m.username}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedDay && (
        <DayDetailPanel
          date={selectedDay}
          activities={dayActivities}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}