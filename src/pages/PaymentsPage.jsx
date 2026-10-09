// src/pages/PaymentsPage.jsx
//
// Org-wide MukkadamPayment ledger for the current season — every deployed
// mukkadam, not just one (reference doc am_integration_docs.md §14). The
// API only filters server-side on mukkadam_name/from_date/to_date/
// payment_status, so the filter bar sticks to exactly those three —
// page/page_size drive the grid's own server-side pagination.
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { usePostHog } from "@posthog/react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Chip,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { DataGrid } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import ClearOutlinedIcon from "@mui/icons-material/ClearOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import QrCodeOutlinedIcon from "@mui/icons-material/QrCodeOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import { mukkadamIntegrationApi } from "../api/mukkadamIntegrationClient";
import { formatCurrency } from "../utils/format";
import { TABLE_BOX_SX, TABLE_GRID_SX, titleCase } from "../components/mukkadams/tableUtils";
import { track, trackException, useDebouncedTrack } from "../analytics/track";

const ALL = "all";
const PAGE_SIZE = 100;

const STATUS_OPTIONS = [
  { value: ALL, label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
];
const STATUS_COLOR = { completed: "success", pending: "warning", failed: "error" };
// Same map plus a neutral entry for the "All statuses" toggle, which has
// no inherent severity of its own — keyed to the theme's primary accent.
const STATUS_TOGGLE_COLOR = { [ALL]: "primary", ...STATUS_COLOR };
const MODE_ICON = { bank_transfer: AccountBalanceOutlinedIcon, upi: QrCodeOutlinedIcon, cash: PaymentsOutlinedIcon };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function monthStartISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

const DATE_PRESETS = [
  { label: "Last 7 days", from: () => daysAgoISO(6), to: todayISO },
  { label: "Last 30 days", from: () => daysAgoISO(29), to: todayISO },
  { label: "This month", from: monthStartISO, to: todayISO },
];

function maskAccount(accountNumber) {
  if (!accountNumber) return "—";
  return `••••${accountNumber.slice(-4)}`;
}

function buildColumns(navigate) {
  return [
    { field: "payment_date", headerName: "Date", width: 110, valueGetter: (v) => v ?? "—" },
    {
      field: "mukkadam_name",
      headerName: "Mukkadam",
      flex: 1.2,
      minWidth: 180,
      renderCell: (params) => (
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
          onClick={() => navigate(`/mukkadams/${params.row.mukkadam_id}`)}
        >
          {params.value}
        </Typography>

      ),
    },
    {
      field: "amount",
      headerName: "Amount",
      width: 130,
      renderCell: (params) => <Typography sx={{ fontWeight: 700 }}>{formatCurrency(params.value)}</Typography>,
    },
    {
      field: "payment_type",
      headerName: "Type",
      width: 110,
      renderCell: (params) => <Chip size="small" label={titleCase(params.value)} variant="outlined" />,
    },
    {
      field: "payment_mode",
      headerName: "Mode",
      width: 150,
      renderCell: (params) => {
        const Icon = MODE_ICON[params.value] || PaymentsOutlinedIcon;
        return (
          <Stack direction="row" spacing={0.6} sx={{ alignItems: "center" }}>
            <Icon sx={{ fontSize: 16, color: "text.secondary" }} />
            <Typography variant="body2">{titleCase(params.value)}</Typography>
          </Stack>
        );
      },
    },
    {
      field: "status",
      headerName: "Status",
      width: 120,
      renderCell: (params) => (
        <Chip size="small" label={titleCase(params.value)} color={STATUS_COLOR[params.value] || "default"} />
      ),
    },
    { field: "transaction_id", headerName: "Transaction ID", width: 160, valueGetter: (v) => v || "—" },
    {
      field: "paid_to_account",
      headerName: "Bank details",
      width: 140,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title={params.row.paid_to_ifsc ? `IFSC ${params.row.paid_to_ifsc}` : "No bank details on this payment"}>
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {maskAccount(params.value)}
          </Typography>
        </Tooltip>
      ),
    },
    // { field: "paid_by", headerName: "Recorded by", width: 130, valueGetter: (v) => v || "—" },
    // {
    //   field: "notes",
    //   headerName: "Notes",
    //   flex: 1,
    //   minWidth: 160,
    //   sortable: false,
    //   renderCell: (params) =>
    //     params.value ? (
    //       <Tooltip title={params.value}>
    //         <Typography variant="body2" noWrap>
    //           {params.value}
    //         </Typography>
    //       </Tooltip>
    //     ) : (
    //       <Typography variant="body2" color="text.disabled">
    //         —
    //       </Typography>
    //     ),
    // },
  ];
}

export default function PaymentsPage() {
  const posthog = usePostHog();
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: PAGE_SIZE });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useDebouncedTrack(posthog, "payments_search_applied", q);

  // Any filter change invalidates the current page — jump back to page 1
  // rather than requesting a page number that may no longer exist.
  useEffect(() => {
    setPaginationModel((m) => ({ ...m, page: 0 }));
  }, [deferredQ, fromDate, toDate, statusFilter]);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    mukkadamIntegrationApi
      .getCurrentSeasonPayments(
        {
          mukkadamName: deferredQ.trim() || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          paymentStatus: statusFilter === ALL ? undefined : statusFilter,
          page: paginationModel.page + 1,
          pageSize: paginationModel.pageSize,
        },
        controller.signal,
      )
      .then((res) => {
        if (!ignore) setData(res);
      })
      .catch((err) => {
        if (ignore || err.name === "AbortError") return;
        trackException(posthog, err);
        setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredQ, fromDate, toDate, statusFilter, paginationModel, reloadToken]);

  const rows = useMemo(() => data?.results ?? [], [data]);
  const pagination = data?.pagination;

  function applyPreset(preset) {
    setFromDate(preset.from());
    setToDate(preset.to());
    track(posthog, "payments_date_preset_applied", { preset: preset.label });
  }

  function clearDateRange() {
    setFromDate("");
    setToDate("");
  }

  const columns = useMemo(() => buildColumns(navigate), [navigate]);

  return (
    <Box className="page">
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 0.5, flexWrap: "wrap" }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Payments
        </Typography>
        {data?.season_code && <Chip size="small" label={data.season_code} color="primary" variant="outlined" />}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Every mukkadam payment transaction recorded this season, across all deployed mukkadams.
      </Typography>

      {error ? (
        <Alert
          severity="error"
          action={
            <IconButton size="small" onClick={() => setReloadToken((t) => t + 1)} aria-label="Retry">
              <RefreshOutlinedIcon fontSize="small" />
            </IconButton>
          }
        >
          Could not load payments: {error}
        </Alert>
      ) : (
        <>
          {/* Grouped ERP-style filter bar — search / date range / status, each its own
              color-coded cluster (accent chips + a soft primary-tinted surface, same
              gradient technique as the Revenue & Profitability header card) */}
          <Box
            sx={{
              mb: 2,
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.06)} 0%, ${alpha(t.palette.primary.main, 0)} 70%)`,
            }}
          >
            <Stack direction={{ xs: "column", lg: "row" }} spacing={2.5}>
              <Box
                sx={{
                  flex: "1 1 240px",
                  pl: 1.5,
                  borderLeft: "3px solid",
                  borderColor: "primary.main",
                }}
              >
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 0.5 }}>
                  <SearchIcon sx={{ fontSize: 15, color: "primary.main" }} />
                  <Typography
                    variant="caption"
                    color="primary.dark"
                    sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.68rem" }}
                  >
                    Search
                  </Typography>
                </Stack>
                <TextField
                  placeholder="Search by mukkadam name…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  size="small"
                  fullWidth
                  sx={{ bgcolor: "background.paper", borderRadius: 1 }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                      endAdornment: q && (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setQ("")} aria-label="Clear search">
                            <ClearOutlinedIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Box>

              <Box
                sx={{
                  flex: "1 1 360px",
                  pl: 1.5,
                  borderLeft: "3px solid",
                  borderColor: "info.main",
                }}
              >
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 0.5 }}>
                  <CalendarMonthOutlinedIcon sx={{ fontSize: 15, color: "info.main" }} />
                  <Typography
                    variant="caption"
                    color="info.dark"
                    sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.68rem" }}
                  >
                    Date range
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <TextField
                    type="date"
                    label="From"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    size="small"
                    fullWidth
                    sx={{ bgcolor: "background.paper", borderRadius: 1 }}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    type="date"
                    label="To"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    size="small"
                    fullWidth
                    sx={{ bgcolor: "background.paper", borderRadius: 1 }}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Stack>
                <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
                  {DATE_PRESETS.map((preset) => (
                    <Chip
                      key={preset.label}
                      size="small"
                      icon={<CalendarMonthOutlinedIcon sx={{ fontSize: 14 }} />}
                      label={preset.label}
                      variant="outlined"
                      color="info"
                      onClick={() => applyPreset(preset)}
                      sx={{ bgcolor: "background.paper" }}
                    />
                  ))}
                  {(fromDate || toDate) && (
                    <Chip size="small" label="Clear" variant="outlined" onClick={clearDateRange} sx={{ bgcolor: "background.paper" }} />
                  )}
                </Stack>
              </Box>

              <Box
                sx={{
                  flex: "1 1 280px",
                  pl: 1.5,
                  borderLeft: "3px solid",
                  borderColor: "secondary.main",
                }}
              >
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 0.5 }}>
                  <TuneOutlinedIcon sx={{ fontSize: 15, color: "secondary.main" }} />
                  <Typography
                    variant="caption"
                    color="secondary.dark"
                    sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.68rem" }}
                  >
                    Status
                  </Typography>
                </Stack>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={statusFilter}
                  onChange={(_, v) => {
                    if (v !== null) {
                      setStatusFilter(v);
                      track(posthog, "payments_filter_applied", { filter: "status", value: v });
                    }
                  }}
                  sx={{ display: "flex", flexWrap: "wrap", bgcolor: "background.paper", borderRadius: 1 }}
                >
                  {STATUS_OPTIONS.map((opt) => {
                    const c = STATUS_TOGGLE_COLOR[opt.value];
                    return (
                      <ToggleButton
                        key={opt.value}
                        value={opt.value}
                        sx={{
                          textTransform: "none",
                          px: 1.5,
                          "&.Mui-selected": {
                            bgcolor: (t) => alpha(t.palette[c].main, 0.16),
                            color: `${c}.dark`,
                            fontWeight: 700,
                            "&:hover": { bgcolor: (t) => alpha(t.palette[c].main, 0.24) },
                          },
                        }}
                      >
                        {opt.label}
                      </ToggleButton>
                    );
                  })}
                </ToggleButtonGroup>
              </Box>
            </Stack>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
            {rows.length.toLocaleString("en-IN")} of {(pagination?.count ?? 0).toLocaleString("en-IN")} transactions
          </Typography>

          <Box sx={{ ...TABLE_BOX_SX, height: 560 }}>
            <DataGrid
              rows={rows}
              columns={columns}
              loading={loading}
              getRowId={(row) => row.id}
              disableRowSelectionOnClick
              paginationMode="server"
              rowCount={pagination?.count ?? 0}
              paginationModel={paginationModel}
              onPaginationModelChange={(model) => {
                setPaginationModel(model);
                track(posthog, "payments_page_changed", { page: model.page, page_size: model.pageSize });
              }}
              pageSizeOptions={[50, 100, 200]}
              sx={{ ...TABLE_GRID_SX, height: "100%", "& .MuiDataGrid-cell": { display: "flex", alignItems: "center" } }}
            />
          </Box>
        </>
      )}
    </Box>
  );
}
