// src/components/financials/ClusterFinancialsTable.jsx
//
// Replaces the earlier DataGrid + right-side drawer: DataGrid's expandable
// "detail panel" row is an MUI X Pro feature and this app only has the
// free @mui/x-data-grid, so a per-cluster drill-down means a plain MUI
// Table with its own collapsible rows instead — the same chevron +
// Collapse + nested sticky-header table pattern already established in
// ClusterVault/MukkadamPayoutRow on the per-cluster page, applied here so
// the whole app reads as one design language rather than two.
//
// Clicking a cluster row expands it in place to show that cluster's own
// farmer-level breakdown as a nested table (revenue/payout/net/vault
// balance/status per farmer) — no extra fetch, business-summary already
// nests farmers[] per cluster. Only one cluster expands at a time
// (accordion-style): with ~195 clusters, letting many stay open at once
// would make an already-long page unbounded.
//
// Revenue/Payout/Cost are kept as three separate columns (not folded into
// one compact cell) per request. To still avoid horizontal scrolling, the
// financial-health chip carries its margin % in its own label instead of
// a separate column, and Farmers count and Vault holding move into the
// expanded detail's stat line instead of eating a column each up top.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Typography,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { formatCurrency } from "../../utils/format";
import { clusterFinancialStatus, formatPercent } from "./financialUtils";
import { STATUS_ICON } from "./statusIcons";
import { titleCase } from "../mukkadams/tableUtils";

// Same green-banner/alternating-row/hover-tint language every DataGrid
// table in this app already uses (MukkadamJobsBoard, MukkadamInsightsTable)
// — hand-built here since this is a plain Table, not a DataGrid, but kept
// visually identical so this table doesn't read as a one-off.
const HEAD_ROW_SX = {
  "& .MuiTableCell-root": {
    bgcolor: "rgb(15, 110, 86)",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
    borderBottom: "none",
  },
  "& .MuiTableSortLabel-root": { color: "#ffffff !important" },
  "& .MuiTableSortLabel-icon": { color: "rgba(255,255,255,0.7) !important" },
};

const HEAD_CELLS = [
  { key: "cluster_name", label: "Cluster", align: "left" },
  { key: "status", label: "Deployment", align: "left" },
  { key: "revenue_served", label: "Revenue", align: "right" },
  { key: "mukkadam_payout", label: "Payout", align: "right" },
  { key: "cluster_cost", label: "Cost", align: "right" },
  { key: "cluster_net", label: "Net", align: "right" },
  { key: "health", label: "Health", align: "left", sortable: false },
  { key: "overdue_count", label: "Overdue", align: "right" },
  { key: "actions", label: "", align: "right", sortable: false },
];

const NESTED_HEAD_SX = {
  fontWeight: 700,
  fontSize: 10.5,
  letterSpacing: 0.35,
  textTransform: "uppercase",
  color: "text.secondary",
  bgcolor: "background.paper",
  whiteSpace: "nowrap",
};

function formatDeployedAt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function healthChipLabel(status) {
  return status.margin === null ? status.label : `${status.label} · ${formatPercent(status.margin)}`;
}

function sortValue(cluster, key) {
  return cluster[key];
}

function FarmerBreakdownTable({ farmers }) {
  if (!farmers?.length) {
    return (
      <Typography variant="body2" color="text.disabled">
        No farmer breakdown for this cluster.
      </Typography>
    );
  }
  return (
    <TableContainer
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5,
        bgcolor: "background.paper",
        maxHeight: 320,
        overflowY: "auto",
      }}
    >
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={NESTED_HEAD_SX}>Farmer</TableCell>
            <TableCell sx={NESTED_HEAD_SX} align="right">Revenue</TableCell>
            <TableCell sx={NESTED_HEAD_SX} align="right">Payout</TableCell>
            <TableCell sx={NESTED_HEAD_SX} align="right">Net</TableCell>
            <TableCell sx={NESTED_HEAD_SX} align="right">Vault Balance</TableCell>
            <TableCell sx={NESTED_HEAD_SX}>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {farmers.map((f) => {
            const status = clusterFinancialStatus(f.farmer_net, f.revenue_served);
            const StatusIcon = STATUS_ICON[status.key];
            return (
              <TableRow key={f.farmer_id} hover>
                <TableCell sx={{ fontWeight: 600 }}>
                  {f.farmer_name}
                  {f.is_overdue && (
                    <Chip size="small" label="Overdue" color="error" variant="outlined" sx={{ ml: 0.75, height: 18, fontSize: 9.5 }} />
                  )}
                </TableCell>
                <TableCell align="right">{formatCurrency(f.revenue_served)}</TableCell>
                <TableCell align="right" sx={{ color: "text.secondary" }}>
                  {formatCurrency(f.mukkadam_payout)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: f.farmer_net >= 0 ? "success.main" : "error.main" }}>
                  {formatCurrency(f.farmer_net)}
                </TableCell>
                <TableCell align="right" sx={{ color: f.balance < 0 ? "error.main" : "text.disabled" }}>
                  {formatCurrency(f.balance)}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    icon={<StatusIcon sx={{ fontSize: "13px !important" }} />}
                    label={status.label}
                    color={status.color}
                    variant="outlined"
                    sx={{ height: 20, fontSize: 10 }}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function ClusterRow({ cluster, index, expanded, onToggle }) {
  const navigate = useNavigate();
  const status = clusterFinancialStatus(cluster.cluster_net, cluster.revenue_served);
  const StatusIcon = STATUS_ICON[status.key];
  const deployed = cluster.status === "deployed";

  return (
    <>
      <TableRow
        hover
        onClick={onToggle}
        sx={{
          cursor: "pointer",
          bgcolor: index % 2 === 0 ? "#ffffff" : "#f5f9f5",
          "&:hover": { bgcolor: "#e8f5e9 !important" },
          "& .MuiTableCell-root": { borderBottom: expanded ? "none" : undefined },
        }}
      >
        <TableCell sx={{ width: 40, py: 0.5 }}>
          <IconButton size="small" aria-label={expanded ? "Collapse" : "Expand"}>
            <KeyboardArrowDownIcon
              fontSize="small"
              sx={{ transition: "transform 160ms ease", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </IconButton>
        </TableCell>
        <TableCell sx={{ fontWeight: 600 }}>{cluster.cluster_name}</TableCell>
        <TableCell>
          <Chip
            size="small"
            label={cluster.status ? titleCase(cluster.status) : "Unknown"}
            color={deployed ? "success" : "default"}
            variant={deployed ? "filled" : "outlined"}
            sx={{ height: 20, fontSize: 10.5 }}
          />
        </TableCell>
        <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
          {formatCurrency(cluster.revenue_served)}
        </TableCell>
        <TableCell align="right" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
          {formatCurrency(cluster.mukkadam_payout)}
        </TableCell>
        <TableCell align="right" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
          {formatCurrency(cluster.cluster_cost)}
        </TableCell>
        <TableCell align="right" sx={{ fontWeight: 700, color: cluster.cluster_net >= 0 ? "success.main" : "error.main", whiteSpace: "nowrap" }}>
          {formatCurrency(cluster.cluster_net)}
        </TableCell>
        <TableCell>
          <Chip
            size="small"
            icon={<StatusIcon sx={{ fontSize: "13px !important" }} />}
            label={healthChipLabel(status)}
            color={status.color}
            variant={status.key === "healthy" ? "filled" : "outlined"}
          />
        </TableCell>
        <TableCell align="right">
          {cluster.overdue_count > 0 ? (
            <Chip
              size="small"
              icon={<WarningAmberOutlinedIcon sx={{ fontSize: "13px !important" }} />}
              label={cluster.overdue_count}
              color="error"
              variant="outlined"
            />
          ) : (
            <Typography variant="body2" color="text.disabled">—</Typography>
          )}
        </TableCell>
        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
          <Button
            size="small"
            variant="outlined"
            endIcon={<OpenInNewOutlinedIcon sx={{ fontSize: "14px !important" }} />}
            onClick={() => navigate(`/clusters/${cluster.cluster_id}`)}
            sx={{ whiteSpace: "nowrap" }}
          >
            View
          </Button>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={HEAD_CELLS.length + 1} sx={{ py: 0, borderBottom: expanded ? "1px solid" : "none", borderColor: "divider" }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2, px: 2, bgcolor: "action.hover" }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 1, flexWrap: "wrap" }}>
                {cluster.deployed_at && (
                  <Typography variant="caption" color="text.secondary">
                    Deployed {formatDeployedAt(cluster.deployed_at)}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {cluster.farmer_count} farmer{cluster.farmer_count === 1 ? "" : "s"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Vault holding {formatCurrency(cluster.holding_balance)}
                </Typography>
              </Stack>
              {cluster.not_found_farmer_ids?.length > 0 && (
                <Typography variant="caption" color="error" sx={{ display: "block", mb: 1 }}>
                  {cluster.not_found_farmer_ids.length} farmer id{cluster.not_found_farmer_ids.length === 1 ? "" : "s"} didn&apos;t
                  match a known farmer.
                </Typography>
              )}
              <FarmerBreakdownTable farmers={cluster.farmers} />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function ClusterFinancialsTable({ clusters }) {
  const [sortKey, setSortKey] = useState("cluster_net");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [expandedId, setExpandedId] = useState(null);

  // A new filtered/sorted result set (search or status filter changed)
  // should snap back to page 1 — a stale page 3 on a narrower set would
  // just render empty.
  useEffect(() => {
    setPage(0);
  }, [clusters]);

  const sorted = useMemo(() => {
    const copy = [...clusters];
    copy.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return copy;
  }, [clusters, sortKey, sortDir]);

  const paged = sorted.slice(page * pageSize, page * pageSize + pageSize);

  function handleSort(key) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <Box sx={{ bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={HEAD_ROW_SX}>
              <TableCell sx={{ width: 40 }} />
              {HEAD_CELLS.map((col) => (
                <TableCell key={col.key} align={col.align}>
                  {col.sortable === false ? (
                    col.label
                  ) : (
                    <TableSortLabel
                      active={sortKey === col.key}
                      direction={sortKey === col.key ? sortDir : "asc"}
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                    </TableSortLabel>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paged.map((cluster, index) => (
              <ClusterRow
                key={cluster.cluster_id}
                cluster={cluster}
                index={index}
                expanded={expandedId === cluster.cluster_id}
                onToggle={() => setExpandedId((id) => (id === cluster.cluster_id ? null : cluster.cluster_id))}
              />
            ))}
            {paged.length === 0 && (
              <TableRow>
                <TableCell colSpan={HEAD_CELLS.length + 1} align="center" sx={{ py: 4, color: "text.disabled" }}>
                  No clusters match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={clusters.length}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => {
          setPageSize(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />
    </Box>
  );
}
