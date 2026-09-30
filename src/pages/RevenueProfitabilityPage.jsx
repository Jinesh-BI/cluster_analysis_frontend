// src/pages/RevenueProfitabilityPage.jsx
//
// "How is the business actually doing" — org-wide, across every cluster,
// for finance/founders/investors rather than a single regional manager.
// Built on reference/am_integration_docs.md §12 (business-wide cluster
// financials: revenue/cost/profit per cluster plus one business-wide
// total, in one call) and §13 (mukkadam earned vs. withdrawn, the labor
// side of the same ledger). Both endpoints already return everything in
// one response each — no per-cluster or per-mukkadam follow-up calls.
//
// §12 is explicitly documented as slow (one round trip per cluster
// server-side, ~195 clusters) and fail-fast (any single cluster's vault
// call failing fails the WHOLE request with a 502 naming which cluster
// broke) — so this shows a clear loading state up front and a retry-the-
// whole-call error state naming exactly what the API said, rather than
// silently showing partial/stale data.
import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import RefreshIcon from "@mui/icons-material/Refresh";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import Groups2OutlinedIcon from "@mui/icons-material/Groups2Outlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
// import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import UpdateOutlinedIcon from "@mui/icons-material/UpdateOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { mukkadamIntegrationApi } from "../api/mukkadamIntegrationClient";
import { formatCurrency } from "../utils/format";
import { useCountUp } from "../hooks/useCountUp";
import { ALL, titleCase } from "../components/mukkadams/tableUtils";
import { CLUSTER_STATUS, clusterFinancialStatus, formatPercent } from "../components/financials/financialUtils";
import { STATUS_ICON } from "../components/financials/statusIcons";
import ClusterFinancialsTable from "../components/financials/ClusterFinancialsTable";
import KpiTile from "../components/financials/KpiTile";

const STATUS_ORDER = ["healthy", "thin", "loss", "no_revenue"];

// The deployment-status tab (All / Deployed / Not deployed / ...) — a
// separate axis from the financial health status above. "All" is a UI-only
// pseudo-value; every other tab is whatever raw `status` string a cluster
// actually carries (reference doc §12 deliberately doesn't fix this to an
// enum, so new status values the backend introduces show up as their own
// tab automatically instead of silently missing one).
const STATUS_TAB_ALL = "__all__";

// KPIs/health gauge re-sum from whichever clusters are currently in scope
// (the deployment-status tab) rather than trusting the API's own `totals`
// — reference doc §12 explicitly warns `totals.*` are computed across
// EVERY cluster regardless of status, so a "Deployed" tab showing 178
// clusters would otherwise sit under a KPI row still reflecting all 195.
function sumClusterTotals(clusters) {
  const totals = { revenue_served: 0, mukkadam_payout: 0, cluster_cost: 0, cluster_net: 0, holding_balance: 0, overdue_count: 0 };
  for (const c of clusters) {
    totals.revenue_served += c.revenue_served || 0;
    totals.mukkadam_payout += c.mukkadam_payout || 0;
    totals.cluster_cost += c.cluster_cost || 0;
    totals.cluster_net += c.cluster_net || 0;
    totals.holding_balance += c.holding_balance || 0;
    totals.overdue_count += c.overdue_count || 0;
  }
  return totals;
}

function formatGeneratedAt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Portfolio-health — "how many of our clusters are actually healthy"
// answered as a health-score-style radial gauge (the same visual language
// credit/health scores use in most finance dashboards) plus a segmented
// breakdown bar, instead of making a reader scroll the whole clusters
// table to form that impression themselves.
function PortfolioHealthCard({ clusters }) {
  const counts = useMemo(() => {
    const c = { healthy: 0, thin: 0, loss: 0, no_revenue: 0 };
    for (const cl of clusters) {
      c[clusterFinancialStatus(cl.cluster_net, cl.revenue_served).key] += 1;
    }
    return c;
  }, [clusters]);
  const total = clusters.length || 1;
  const healthyPct = (counts.healthy / total) * 100;
  const animatedPct = useCountUp(healthyPct);

  return (
    <Box sx={{ mb: 3, p: 2.5, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
        Portfolio Health
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ alignItems: "center" }}>
        <Box sx={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
          <CircularProgress
            variant="determinate"
            value={100}
            size={104}
            thickness={4.5}
            sx={{ color: (t) => alpha(t.palette.grey[500], 0.15), position: "absolute" }}
          />
          <CircularProgress
            variant="determinate"
            value={animatedPct}
            size={104}
            thickness={4.5}
            sx={{ color: "success.main", "& .MuiCircularProgress-circle": { strokeLinecap: "round" } }}
          />
          <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1 }}>
              {Math.round(animatedPct)}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Healthy
            </Typography>
          </Box>
        </Box>

        <Box sx={{ flex: 1, width: "100%" }}>
          <Stack direction="row" sx={{ height: 10, borderRadius: 1, overflow: "hidden", mb: 1.5, gap: "2px" }}>
            {STATUS_ORDER.map((key) => {
              const width = (counts[key] / total) * 100;
              if (!width) return null;
              return (
                <Box
                  key={key}
                  sx={{
                    width: `${width}%`,
                    bgcolor: CLUSTER_STATUS[key].color === "default" ? "grey.400" : `${CLUSTER_STATUS[key].color}.main`,
                  }}
                />
              );
            })}
          </Stack>
          <Stack direction="row" spacing={2.5} sx={{ flexWrap: "wrap" }}>
            {STATUS_ORDER.map((key) => {
              const StatusIcon = STATUS_ICON[key];
              return (
                <Stack key={key} direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                  <StatusIcon
                    sx={{ fontSize: 15, color: CLUSTER_STATUS[key].color === "default" ? "text.disabled" : `${CLUSTER_STATUS[key].color}.main` }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {counts[key]} {CLUSTER_STATUS[key].label.toLowerCase()}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

export default function RevenueProfitabilityPage() {
  const [data, setData] = useState(null);
  const [warming, setWarming] = useState(null); // { retry_after_seconds } while the cache is still being built
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [deployTab, setDeployTab] = useState(STATUS_TAB_ALL);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    // `ignore` (not just the AbortController) guards every state setter —
    // React 18 StrictMode double-invokes this effect in dev, aborting the
    // first run. Without `ignore`, that stale run's own `.finally` still
    // fired `setLoading(false)` after the abort, landing on `loading:
    // false, error: null, data: null` for a tick while the second
    // (real) request was still in flight — the render below has no
    // "still loading, just not the initial one" branch, so it fell into
    // the data-rendering path and crashed dereferencing `totals`.
    let ignore = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    mukkadamIntegrationApi
      .getBusinessClusterFinancials(controller.signal)
      .then((res) => {
        if (ignore) return;
        // A 202 while the Redis cache is still (re)building looks like a
        // normal successful response (2xx) to our fetch wrapper — has to be
        // told apart from the real payload by its own `status: "warming"`
        // shape, not by HTTP status code.
        if (res?.status === "warming") {
          setWarming(res);
          setData(null);
        } else {
          setWarming(null);
          setData(res);
        }
      })
      .catch((err) => {
        if (!ignore && err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [reloadTick]);

  // Self-heals per the doc: a cache miss also enqueues its own refresh, so
  // just wait out the suggested interval and check again rather than
  // making the user manually hit Retry.
  useEffect(() => {
    if (!warming) return;
    const timer = setTimeout(() => setReloadTick((t) => t + 1), (warming.retry_after_seconds || 15) * 1000);
    return () => clearTimeout(timer);
  }, [warming]);

  const clusters = useMemo(() => data?.clusters ?? [], [data]);

  // Deployment-status tabs are dynamic (see STATUS_TAB_ALL above) — built
  // from whatever keys cluster_status_counts actually has, "All" pinned first.
  const deployTabs = useMemo(() => {
    const counts = data?.cluster_status_counts ?? {};
    return [
      { key: STATUS_TAB_ALL, label: "All", count: data?.cluster_count ?? clusters.length },
      ...Object.entries(counts).map(([key, count]) => ({ key, label: titleCase(key), count })),
    ];
  }, [data, clusters.length]);

  const tabScopedClusters = useMemo(
    () => (deployTab === STATUS_TAB_ALL ? clusters : clusters.filter((c) => c.status === deployTab)),
    [clusters, deployTab],
  );

  const filteredClusters = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tabScopedClusters.filter((c) => {
      if (term && !c.cluster_name.toLowerCase().includes(term)) return false;
      if (statusFilter === ALL) return true;
      return clusterFinancialStatus(c.cluster_net, c.revenue_served).key === statusFilter;
    });
  }, [tabScopedClusters, search, statusFilter]);

  const totals = data ? sumClusterTotals(tabScopedClusters) : null;
  const businessMargin = totals ? clusterFinancialStatus(totals.cluster_net, totals.revenue_served) : null;
  const generatedAt = formatGeneratedAt(data?.generated_at);

  return (
    <Box className="page">
      <Box
        sx={{
          mb: 3,
          p: 2.5,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.09)} 0%, ${alpha(t.palette.primary.main, 0)} 65%)`,
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Box sx={{ display: "flex", p: 1.1, borderRadius: 2, bgcolor: "primary.main", color: "common.white", flexShrink: 0 }}>
              <TrendingUpOutlinedIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Revenue &amp; Profitability
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Every cluster&apos;s revenue, cost, and profit in one place — the business-wide view, not a single cluster&apos;s.
              </Typography>
            </Box>
          </Stack>
          {data && (
            <Tooltip title="This is a point-in-time snapshot refreshed roughly every 4 hours, not a live query — figures can lag behind the very latest activity by design.">
              <Chip
                icon={<UpdateOutlinedIcon sx={{ fontSize: "15px !important" }} />}
                label={`Season ${data.season_code} · ${data.cluster_count} clusters${generatedAt ? ` · as of ${generatedAt}` : ""}`}
                variant="outlined"
                sx={{ fontWeight: 600, bgcolor: "background.paper", flexShrink: 0, cursor: "help" }}
              />
            </Tooltip>
          )}
        </Stack>
      </Box>

      {error ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => setReloadTick((t) => t + 1)}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : warming ? (
        // Cache miss (right after a fresh deploy, or a very first call in a
        // new environment) — the backend already enqueued its own refresh,
        // so this self-heals; just wait out the suggested interval and
        // check again instead of asking the user to do anything.
        <Alert severity="info" icon={<CircularProgress size={18} />}>
          Generating the latest business financials — this refreshes automatically, checking again in{" "}
          {warming.retry_after_seconds || 15}s…
        </Alert>
      ) : loading && !data ? (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Aggregating every cluster&apos;s vault, mukkadam payouts, and costs — this can take a few seconds…
          </Typography>
          <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap", mb: 3 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} variant="rounded" sx={{ flex: "1 1 200px", minWidth: 190, height: 88 }} />
            ))}
          </Stack>
          <Skeleton variant="rounded" height={360} />
        </>
      ) : !totals ? (
        // Defensive fallback: a 200 response that doesn't actually carry
        // `totals` (an unexpected/incomplete body) shouldn't crash the
        // page dereferencing it — surface it as a visible problem instead.
        <Alert severity="warning">Received a response from the server, but it was missing the expected financial totals.</Alert>
      ) : (
        <>
          <Tabs
            value={deployTab}
            onChange={(_, v) => setDeployTab(v)}
            sx={{ mb: 2, minHeight: 40, borderBottom: "1px solid", borderColor: "divider" }}
          >
            {deployTabs.map((tab) => (
              <Tab
                key={tab.key}
                value={tab.key}
                sx={{ minHeight: 40, py: 0.5, textTransform: "none", fontWeight: 600 }}
                label={
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                    <span>{tab.label}</span>
                    <Chip size="small" label={tab.count} sx={{ height: 18, fontSize: 10.5 }} />
                  </Stack>
                }
              />
            ))}
          </Tabs>

          <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap", mb: 1 }}>
            <KpiTile
              icon={totals.cluster_net >= 0 ? TrendingUpRoundedIcon : TrendingDownRoundedIcon}
              label={`Net profit (${formatPercent(businessMargin.margin)} margin)`}
              rawValue={totals.cluster_net}
              format={formatCurrency}
              color={totals.cluster_net >= 0 ? "success" : "error"}
              hero
              big
            />
            <KpiTile
              icon={PaidOutlinedIcon}
              label="Revenue served"
              rawValue={totals.revenue_served}
              format={formatCurrency}
              color="success"
              hero
            />
            <KpiTile
              icon={Groups2OutlinedIcon}
              label="Mukkadam payouts"
              rawValue={totals.mukkadam_payout}
              format={formatCurrency}
            />
            <KpiTile
              icon={AccountBalanceOutlinedIcon}
              label="Cluster costs"
              rawValue={totals.cluster_cost}
              format={formatCurrency}
            />
            <KpiTile
              icon={SavingsRoundedIcon}
              label="Vault holding"
              rawValue={totals.holding_balance}
              format={formatCurrency}
              tooltip="Prepaid farmer vault money still unspent across every cluster — not counted as revenue until it's actually spent on completed work."
            />
            {/* <KpiTile
              icon={WarningAmberOutlinedIcon}
              label="Overdue farmers"
              rawValue={totals.overdue_count}
              format={(v) => Math.round(v)}
              color={totals.overdue_count > 0 ? "error" : "text.primary"}
            /> */}
          </Stack>

          <PortfolioHealthCard clusters={tabScopedClusters} />

          <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: "wrap", alignItems: "center" }}>
            <TextField
              placeholder="Search cluster name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              sx={{ flex: 1, minWidth: 220 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: search && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearch("")} aria-label="Clear search">
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Select size="small" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 180 }}>
              <MenuItem value={ALL}>All statuses</MenuItem>
              {Object.entries(CLUSTER_STATUS).map(([key, meta]) => (
                <MenuItem key={key} value={key}>
                  {meta.label}
                </MenuItem>
              ))}
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
              {filteredClusters.length} of {tabScopedClusters.length} clusters
            </Typography>
          </Stack>

          <ClusterFinancialsTable clusters={filteredClusters} />

          {/* Mukkadam Earned vs. Withdrawn now lives on its own page (see
              sidebar: Finance → Mukkadam Earnings) — it answers a distinct
              question (labor payables) from this page's cluster P&L, so a
              cross-link here replaces what used to be an inline section. */}
          <Button
            component={RouterLink}
            to="/mukkadam-earnings"
            endIcon={<ArrowForwardIcon fontSize="small" />}
            sx={{ mt: 3 }}
          >
            View mukkadam earned vs. withdrawn
          </Button>
        </>
      )}
    </Box>
  );
}
