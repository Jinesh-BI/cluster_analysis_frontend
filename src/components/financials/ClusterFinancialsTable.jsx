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
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Chip,
  Collapse,
  IconButton,
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
import { formatCurrency } from "../../utils/format";
import { clusterFinancialStatus, formatPercent } from "./financialUtils";

const HEAD_CELLS = [
  { key: "cluster_name", label: "Cluster", align: "left" },
  { key: "farmer_count", label: "Farmers", align: "right" },
  { key: "revenue_served", label: "Revenue", align: "right" },
  { key: "mukkadam_payout", label: "Payout", align: "right" },
  { key: "cluster_cost", label: "Cost", align: "right" },
  { key: "cluster_net", label: "Net", align: "right" },
  { key: "margin", label: "Margin", align: "right" },
  { key: "status", label: "Status", align: "left", sortable: false },
  { key: "holding_balance", label: "Holding", align: "right" },
  { key: "overdue_count", label: "Overdue", align: "right" },
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

function sortValue(cluster, key) {
  if (key === "margin") return clusterFinancialStatus(cluster.cluster_net, cluster.revenue_served).margin ?? -Infinity;
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
                  <Chip size="small" label={status.label} color={status.color} variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function ClusterRow({ cluster, expanded, onToggle }) {
  const status = clusterFinancialStatus(cluster.cluster_net, cluster.revenue_served);
  return (
    <>
      <TableRow hover onClick={onToggle} sx={{ cursor: "pointer" }}>
        <TableCell sx={{ width: 40, py: 0.5 }}>
          <IconButton size="small" aria-label={expanded ? "Collapse" : "Expand"}>
            <KeyboardArrowDownIcon
              fontSize="small"
              sx={{ transition: "transform 160ms ease", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </IconButton>
        </TableCell>
        <TableCell sx={{ fontWeight: 600 }}>{cluster.cluster_name}</TableCell>
        <TableCell align="right">{cluster.farmer_count}</TableCell>
        <TableCell align="right" sx={{ fontWeight: 600 }}>
          {formatCurrency(cluster.revenue_served)}
        </TableCell>
        <TableCell align="right" sx={{ color: "text.secondary" }}>
          {formatCurrency(cluster.mukkadam_payout)}
        </TableCell>
        <TableCell align="right" sx={{ color: "text.secondary" }}>
          {formatCurrency(cluster.cluster_cost)}
        </TableCell>
        <TableCell align="right" sx={{ fontWeight: 700, color: cluster.cluster_net >= 0 ? "success.main" : "error.main" }}>
          {formatCurrency(cluster.cluster_net)}
        </TableCell>
        <TableCell align="right" sx={{ fontWeight: 600, color: status.color === "default" ? "text.disabled" : `${status.color}.main` }}>
          {formatPercent(status.margin)}
        </TableCell>
        <TableCell>
          <Chip size="small" label={status.label} color={status.color} variant={status.key === "healthy" ? "filled" : "outlined"} />
        </TableCell>
        <TableCell align="right" sx={{ color: "text.disabled" }}>
          {formatCurrency(cluster.holding_balance)}
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
      </TableRow>
      <TableRow>
        <TableCell colSpan={HEAD_CELLS.length + 1} sx={{ py: 0, borderBottom: expanded ? "1px solid" : "none", borderColor: "divider" }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2, px: 2, bgcolor: "action.hover" }}>
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
      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 40 }} />
              {HEAD_CELLS.map((col) => (
                <TableCell key={col.key} align={col.align} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
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
            {paged.map((cluster) => (
              <ClusterRow
                key={cluster.cluster_id}
                cluster={cluster}
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
