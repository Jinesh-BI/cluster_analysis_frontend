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
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Skeleton,
  Stack,
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
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { mukkadamIntegrationApi } from "../api/mukkadamIntegrationClient";
import { formatCurrency } from "../utils/format";
import { ALL } from "../components/mukkadams/tableUtils";
import { CLUSTER_STATUS, clusterFinancialStatus, formatPercent } from "../components/financials/financialUtils";
import ClusterFinancialsTable from "../components/financials/ClusterFinancialsTable";
// import MukkadamEarnedWithdrawnSection from "../components/financials/MukkadamEarnedWithdrawnSection";

function KpiTile({ icon: Icon, label, value, color = "text.primary", hero = false, tooltip }) {
  return (
    <Box
      sx={{
        flex: "1 1 200px",
        minWidth: 190,
        p: 2,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: hero ? `${color}.light` : "divider",
        bgcolor: hero ? (t) => alpha(t.palette[color]?.main ?? t.palette.grey[500], 0.06) : "background.paper",
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
        <Box
          sx={{
            display: "flex",
            p: 0.65,
            borderRadius: 1,
            bgcolor: hero ? `${color}.main` : "action.selected",
            color: hero ? "common.white" : "text.secondary",
          }}
        >
          <Icon sx={{ fontSize: 16 }} />
        </Box>
        <Typography
          variant="subtitle2"
          color="text.secondary"
          sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, fontSize: "0.66rem" }}
        >
          {label}
        </Typography>
        {tooltip && (
          <Tooltip title={tooltip}>
            <InfoOutlinedIcon sx={{ fontSize: 13, color: "text.disabled", cursor: "help" }} />
          </Tooltip>
        )}
      </Stack>
      <Typography variant="h6" sx={{ fontWeight: 800, color: hero ? `${color}.dark` : "text.primary" }}>
        {value}
      </Typography>
    </Box>
  );
}

// Portfolio-health mix — "how many of our clusters are actually healthy"
// answered as one glanceable segmented bar instead of making a reader
// scroll the whole clusters table to form that impression themselves.
function StatusMixBar({ clusters }) {
  const counts = useMemo(() => {
    const c = { healthy: 0, thin: 0, loss: 0, no_revenue: 0 };
    for (const cl of clusters) {
      c[clusterFinancialStatus(cl.cluster_net, cl.revenue_served).key] += 1;
    }
    return c;
  }, [clusters]);
  const total = clusters.length || 1;

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" sx={{ height: 10, borderRadius: 1, overflow: "hidden", mb: 1, gap: "2px" }}>
        {["healthy", "thin", "loss", "no_revenue"].map((key) => {
          const width = (counts[key] / total) * 100;
          if (!width) return null;
          return (
            <Box
              key={key}
              sx={{
                width: `${width}%`,
                bgcolor:
                  CLUSTER_STATUS[key].color === "default" ? "grey.400" : `${CLUSTER_STATUS[key].color}.main`,
              }}
            />
          );
        })}
      </Stack>
      <Stack direction="row" spacing={2.5} sx={{ flexWrap: "wrap" }}>
        {["healthy", "thin", "loss", "no_revenue"].map((key) => (
          <Stack key={key} direction="row" spacing={0.6} sx={{ alignItems: "center" }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: CLUSTER_STATUS[key].color === "default" ? "grey.400" : `${CLUSTER_STATUS[key].color}.main`,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {counts[key]} {CLUSTER_STATUS[key].label.toLowerCase()}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

export default function RevenueProfitabilityPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
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
        if (!ignore) setData(res);
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

  const clusters = useMemo(() => data?.clusters ?? [], [data]);

  const filteredClusters = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clusters.filter((c) => {
      if (term && !c.cluster_name.toLowerCase().includes(term)) return false;
      if (statusFilter === ALL) return true;
      return clusterFinancialStatus(c.cluster_net, c.revenue_served).key === statusFilter;
    });
  }, [clusters, search, statusFilter]);

  const totals = data?.totals;
  const businessMargin = totals ? clusterFinancialStatus(totals.cluster_net, totals.revenue_served) : null;

  return (
    <Box className="page">
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
        <TrendingUpOutlinedIcon sx={{ fontSize: 24, color: "text.secondary" }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Revenue &amp; Profitability
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Every cluster&apos;s revenue, cost, and profit in one place — the business-wide view, not a single cluster&apos;s.
        {data && ` Season ${data.season_code} · ${data.cluster_count} clusters.`}
      </Typography>

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
          <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap", mb: 1 }}>
            <KpiTile icon={PaidOutlinedIcon} label="Revenue served" value={formatCurrency(totals.revenue_served)} color="success" hero />
            <KpiTile icon={Groups2OutlinedIcon} label="Mukkadam payouts" value={formatCurrency(totals.mukkadam_payout)} color="text.primary" />
            <KpiTile icon={AccountBalanceOutlinedIcon} label="Cluster costs" value={formatCurrency(totals.cluster_cost)} color="text.primary" />
            <KpiTile
              icon={totals.cluster_net >= 0 ? TrendingUpRoundedIcon : TrendingDownRoundedIcon}
              label={`Net (${formatPercent(businessMargin.margin)} margin)`}
              value={formatCurrency(totals.cluster_net)}
              color={totals.cluster_net >= 0 ? "success" : "error"}
              hero
            />
            <KpiTile
              icon={SavingsRoundedIcon}
              label="Vault holding"
              value={formatCurrency(totals.holding_balance)}
              tooltip="Prepaid farmer vault money still unspent across every cluster — not counted as revenue until it's actually spent on completed work."
            />
            <KpiTile
              icon={WarningAmberOutlinedIcon}
              label="Overdue farmers"
              value={totals.overdue_count}
              color={totals.overdue_count > 0 ? "error" : "text.primary"}
            />
          </Stack>

          <StatusMixBar clusters={clusters} />

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
              {filteredClusters.length} of {clusters.length} clusters
            </Typography>
          </Stack>

          <ClusterFinancialsTable clusters={filteredClusters} />

          {/* <MukkadamEarnedWithdrawnSection /> */}
        </>
      )}
    </Box>
  );
}
