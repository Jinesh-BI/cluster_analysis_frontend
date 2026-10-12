// src/pages/mukkadams/FarmerPlotActivitiesPage.jsx
//
// Farmer Plot Activities Report (reference/am_integration_docs.md §18) —
// one row per api_activity_id, the grouping key for an original allocation
// plus any carry-forward splits, so a partially-completed activity handed
// off to a second mukkadam still reads as ONE row with both mukkadams
// listed, not two disconnected ones.
//
// Table follows the ClusterFinancialsTable pattern (plain MUI Table with
// its own chevron + Collapse expandable rows, green-banner head, alternating
// row tint, TablePagination) rather than MUI X DataGrid — that component
// exists specifically because DataGrid's expandable "detail panel" is an
// MUI X Pro feature this app doesn't have, so reusing its established,
// already-proven pattern here beats re-solving the same problem with a
// DataGrid dynamic-row-height workaround. Only one row expands at a time
// (accordion-style), same reasoning as that table: with hundreds of
// activities, letting many stay open would make the page unbounded.
//
// season_code is NOT user-editable — the server-side current season is the
// only one this screen targets, passed as a fixed constant. plot_id was
// dropped from the filters entirely: confirmed against the live API that
// it doesn't narrow results on this endpoint, so exposing it would just be
// a filter that silently does nothing. There's also no sort_by on this
// endpoint (results are fixed-order, most-recently-reported first), so the
// header row intentionally has no TableSortLabel, unlike the reference.
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { usePostHog } from "@posthog/react";
import {
  Alert,
  Box,
  Chip,
  Collapse,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import ClearOutlinedIcon from "@mui/icons-material/ClearOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import FingerprintOutlinedIcon from "@mui/icons-material/FingerprintOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import PlayCircleOutlinedIcon from "@mui/icons-material/PlayCircleOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import { mukkadamIntegrationApi } from "../../api/mukkadamIntegrationClient";
import { formatCurrency } from "../../utils/format";
import { formatDateTime } from "../../components/mukkadams/tableUtils";
import { track, useDebouncedTrack } from "../../analytics/track";

const ALL = "all";
// Fixed, not user-editable — see file header.
const SEASON_CODE = "2026-SEP";
const PAGE_SIZE = 25;

const STATUS_META = {
  unallocated: { label: "Unallocated", color: "default", icon: BlockOutlinedIcon },
  allocated: { label: "Allocated", color: "info", icon: PendingActionsOutlinedIcon },
  in_progress: { label: "In progress", color: "warning", icon: PlayCircleOutlinedIcon },
  completed: { label: "Completed", color: "success", icon: TaskAltOutlinedIcon },
};
const STATUS_OPTIONS = ["unallocated", "allocated", "in_progress", "completed"];

// Same green-banner/alternating-row/hover-tint language every table in
// this app already uses — see ClusterFinancialsTable.
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
};

const HEAD_CELLS = [
  { label: "Farmer", align: "left" },
  { label: "Plot", align: "left" },
  { label: "Activity", align: "left" },
  { label: "Status", align: "left" },
  { label: "Progress", align: "left" },
  { label: "Farmer Amount", align: "right" },
  { label: "Last Reported", align: "left" },
  { label: "Mukkadams", align: "left" },
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

function StatusChip({ status }) {
  const meta = STATUS_META[status];
  if (!meta) return <Chip size="small" label={status || "—"} variant="outlined" />;
  const Icon = meta.icon;
  return <Chip size="small" icon={<Icon sx={{ fontSize: 14 }} />} label={meta.label} color={meta.color} />;
}

function ProgressCell({ totalDone, totalArea }) {
  if (totalArea == null) {
    return (
      <Typography variant="caption" color="text.disabled">
        No plot linked
      </Typography>
    );
  }
  const percent = totalArea > 0 ? Math.min(100, Math.round(((totalDone || 0) / totalArea) * 100)) : 0;
  return (
    <Box sx={{ minWidth: 130 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.3 }}>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {totalDone ?? 0} / {totalArea} ac
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {percent}%
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={percent}
        color={percent >= 100 ? "success" : percent > 0 ? "warning" : "inherit"}
        sx={{ height: 5, borderRadius: 3, bgcolor: "action.hover" }}
      />
    </Box>
  );
}

// Nested, sticky-header breakdown of every mukkadams[] entry — not
// deduplicated by mukkadam_id, since a carry-forward split back to the
// same mukkadam is a second, separate entry (confirmed against live data).
function MukkadamBreakdownTable({ mukkadams }) {
  if (!mukkadams?.length) {
    return (
      <Typography variant="body2" color="text.disabled">
        No mukkadam assigned to this activity yet.
      </Typography>
    );
  }
  return (
    <TableContainer
      sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: "background.paper", maxHeight: 260, overflowY: "auto" }}
    >
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={NESTED_HEAD_SX}>Mukkadam</TableCell>
            <TableCell sx={NESTED_HEAD_SX} align="right">Work done</TableCell>
            <TableCell sx={NESTED_HEAD_SX}>Allocated</TableCell>
            <TableCell sx={NESTED_HEAD_SX} align="right">Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {mukkadams.map((m, i) => (
            <TableRow key={`${m.mukkadam_id}-${i}`} hover>
              <TableCell sx={{ fontWeight: 600 }}>{m.mukkadam_name}</TableCell>
              <TableCell align="right">{m.actual_work_done ?? "—"} ac</TableCell>
              <TableCell>{m.allocated_date || "—"}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: "success.dark" }}>
                {formatCurrency(m.mukkadam_actual_amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function ActivityRow({ activity, index, expanded, onToggle }) {
  const mukkadams = activity.mukkadams || [];
  const totalPaid = mukkadams.reduce((sum, m) => sum + (Number(m.mukkadam_actual_amount) || 0), 0);

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
        <TableCell>
          <Stack spacing={0.1}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {activity.farmer_name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              #{activity.farmer_id} · Booking {activity.booking_id}
            </Typography>
          </Stack>
        </TableCell>
        <TableCell>
          <Chip size="small" icon={<MapOutlinedIcon sx={{ fontSize: "13px !important" }} />} label={activity.plot_code || "—"} variant="outlined" />
        </TableCell>
        <TableCell>
          <Stack spacing={0.1}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {activity.activity_name || "—"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Activity #{activity.activity_id}
            </Typography>
          </Stack>
        </TableCell>
        <TableCell>
          <StatusChip status={activity.status} />
        </TableCell>
        <TableCell>
          <ProgressCell totalDone={activity.total_done} totalArea={activity.total_area} />
        </TableCell>
        <TableCell align="right" sx={{ fontWeight: 700, color: "success.dark", whiteSpace: "nowrap" }}>
          {formatCurrency(activity.farmer_amount)}
        </TableCell>
        <TableCell sx={{ whiteSpace: "nowrap" }}>{activity.completion_date ? formatDateTime(activity.completion_date) : "—"}</TableCell>
        <TableCell>
          {mukkadams.length === 0 ? (
            <Typography variant="caption" color="text.disabled">
              No mukkadam
            </Typography>
          ) : (
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <GroupsOutlinedIcon sx={{ fontSize: 15, color: "secondary.main" }} />
              <Chip
                size="small"
                label={`${mukkadams.length} worker${mukkadams.length === 1 ? "" : "s"}`}
                color="secondary"
                variant="outlined"
                sx={{ height: 20, fontSize: 10.5 }}
              />
              <Typography variant="caption" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                {formatCurrency(totalPaid)}
              </Typography>
            </Stack>
          )}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={HEAD_CELLS.length + 1} sx={{ py: 0, borderBottom: expanded ? "1px solid" : "none", borderColor: "divider" }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2, px: 2, bgcolor: "action.hover" }}>
              <MukkadamBreakdownTable mukkadams={mukkadams} />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function FarmerPlotActivitiesPage() {
  const posthog = usePostHog();

  const [status, setStatus] = useState(ALL);
  const [farmerName, setFarmerName] = useState("");
  const deferredFarmerName = useDeferredValue(farmerName);
  const [farmerId, setFarmerId] = useState("");
  const [activityId, setActivityId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [expandedId, setExpandedId] = useState(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useDebouncedTrack(posthog, "farmer_plot_activities_search_applied", farmerName);

  // Any filter change invalidates the current page.
  const filterKey = `${status}|${deferredFarmerName}|${farmerId}|${activityId}|${dateFrom}|${dateTo}`;
  const prevFilterKey = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKey.current !== filterKey) {
      prevFilterKey.current = filterKey;
      setPage(0);
    }
  }, [filterKey]);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    mukkadamIntegrationApi
      .getFarmerPlotActivitiesReport(
        {
          status: status === ALL ? undefined : status,
          farmerName: deferredFarmerName.trim() || undefined,
          farmerId: farmerId.trim() || undefined,
          activityId: activityId.trim() || undefined,
          seasonCode: SEASON_CODE,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          page: page + 1,
          pageSize,
        },
        controller.signal,
      )
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
  }, [status, deferredFarmerName, farmerId, activityId, dateFrom, dateTo, page, pageSize]);

  const rows = useMemo(() => data?.results ?? [], [data]);
  const pagination = data?.pagination;

  function clearDateRange() {
    setDateFrom("");
    setDateTo("");
  }

  return (
    <Box className="page">
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 0.5, flexWrap: "wrap" }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Farmer Plot Activities
        </Typography>
        <Chip size="small" label={SEASON_CODE} color="primary" variant="outlined" />
        {pagination && <Chip size="small" label={`${pagination.total_count.toLocaleString("en-IN")} activities`} variant="outlined" />}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Every plot activity and its completion state, with every mukkadam who worked it — carry-forward splits grouped under one row.
      </Typography>

      {/* Grouped ERP-style filter bar: identity / dates / status */}
      <Box
        sx={{
          mb: 2,
          p: 2,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.05)} 0%, ${alpha(t.palette.primary.main, 0)} 70%)`,
        }}
      >
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", pl: 1.5, borderLeft: "3px solid", borderColor: "primary.main" }}>
            <BadgeOutlinedIcon sx={{ fontSize: 15, color: "primary.main", flexShrink: 0 }} />
            <TextField
              placeholder="Search farmer name…"
              value={farmerName}
              onChange={(e) => setFarmerName(e.target.value)}
              size="small"
              sx={{ flex: 1, bgcolor: "background.paper" }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: farmerName && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setFarmerName("")} aria-label="Clear">
                        <ClearOutlinedIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              placeholder="Farmer ID"
              value={farmerId}
              onChange={(e) => setFarmerId(e.target.value)}
              size="small"
              sx={{ width: 150, bgcolor: "background.paper", flexShrink: 0 }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><FingerprintOutlinedIcon fontSize="small" /></InputAdornment> } }}
            />
            <TextField
              placeholder="Activity ID"
              value={activityId}
              onChange={(e) => setActivityId(e.target.value.replace(/[^0-9]/g, ""))}
              size="small"
              sx={{ width: 150, bgcolor: "background.paper", flexShrink: 0 }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Inventory2OutlinedIcon fontSize="small" /></InputAdornment> } }}
            />
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignItems: "center", pl: 1.5, borderLeft: "3px solid", borderColor: "info.main", flexWrap: "wrap" }}>
            <CalendarMonthOutlinedIcon sx={{ fontSize: 15, color: "info.main" }} />
            <TextField
              type="date"
              label="Completed from"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ minWidth: 165, bgcolor: "background.paper" }}
            />
            <TextField
              type="date"
              label="Completed to"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ minWidth: 165, bgcolor: "background.paper" }}
            />
            {(dateFrom || dateTo) && <Chip size="small" label="Clear dates" variant="outlined" onClick={clearDateRange} />}
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignItems: "center", pl: 1.5, borderLeft: "3px solid", borderColor: "secondary.main" }}>
            <FilterAltOutlinedIcon sx={{ fontSize: 15, color: "secondary.main" }} />
            <Select
              size="small"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                track(posthog, "farmer_plot_activities_filter_applied", { filter: "status", value: e.target.value });
              }}
              sx={{ minWidth: 170, bgcolor: "background.paper" }}
            >
              <MenuItem value={ALL}>All statuses</MenuItem>
              {STATUS_OPTIONS.map((s) => {
                const meta = STATUS_META[s];
                const Icon = meta.icon;
                return (
                  <MenuItem key={s} value={s}>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                      <Icon sx={{ fontSize: 15, color: meta.color === "default" ? "text.disabled" : `${meta.color}.main` }} />
                      <span>{meta.label}</span>
                    </Stack>
                  </MenuItem>
                );
              })}
            </Select>
          </Stack>
        </Stack>
      </Box>

      {error ? (
        <Alert severity="error">Could not load farmer plot activities: {error}</Alert>
      ) : (
        <Box sx={{ bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={HEAD_ROW_SX}>
                  <TableCell sx={{ width: 40 }} />
                  {HEAD_CELLS.map((col) => (
                    <TableCell key={col.label} align={col.align}>
                      {col.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((activity, index) => (
                  <ActivityRow
                    key={activity.api_activity_id}
                    activity={activity}
                    index={index}
                    expanded={expandedId === activity.api_activity_id}
                    onToggle={() => setExpandedId((id) => (id === activity.api_activity_id ? null : activity.api_activity_id))}
                  />
                ))}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={HEAD_CELLS.length + 1} align="center" sx={{ py: 4, color: "text.disabled" }}>
                      No activities match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={pagination?.total_count ?? 0}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </Box>
      )}
    </Box>
  );
}
