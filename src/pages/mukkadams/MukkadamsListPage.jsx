// src/pages/mukkadams/MukkadamsListPage.jsx
//
// Filterable directory of deployed mukkadams, backed by the mukkadam
// integration API (see reference/am_integration_docs.md). Clicking a row
// opens that mukkadam's detail page (allocations/payments/ledger).
// Clicking the bank-account icon instead opens MukkadamBankDetailsDrawer
// without navigating (stopPropagation) — rows with no bank account on file
// have that icon disabled rather than removed, so the column stays
// scannable.
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Chip,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import { mukkadamIntegrationApi } from "../../api/mukkadamIntegrationClient";
import MukkadamBankDetailsDrawer from "../../components/mukkadams/MukkadamBankDetailsDrawer";
import { TABLE_BOX_SX, TABLE_GRID_SX } from "../../components/mukkadams/tableUtils";

const ALL = "all";

const TEAM_TYPE_OPTIONS = [
  { value: ALL, label: "All teams" },
  { value: "true", label: "Permanent" },
  { value: "false", label: "Up / down" },
];

const STATUS_OPTIONS = [
  { value: ALL, label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "inactive", label: "Inactive" },
];

const TENDER_SIGNED_OPTIONS = [
  { value: ALL, label: "Tender: all" },
  { value: "true", label: "Signed" },
  { value: "false", label: "Not signed" },
];

const STATUS_CHIP = {
  active: { label: "Active", color: "success" },
  on_hold: { label: "On hold", color: "warning" },
  inactive: { label: "Inactive", color: "error" },
};

function StatusChip({ status }) {
  if (!status) return <Chip size="small" label="Unknown" variant="outlined" />;
  const { label, color } = STATUS_CHIP[status] || { label: status, color: "default" };
  return <Chip size="small" label={label} color={color} />;
}

const columns = [
  { field: "mukkadam_name", headerName: "Name", flex: 1.2, minWidth: 160 },
  {
    field: "location",
    headerName: "Location",
    flex: 1.4,
    minWidth: 200,
    valueGetter: (_, row) => [row.village, row.taluka, row.district].filter(Boolean).join(", "),
  },
  {
    field: "is_permanent",
    headerName: "Team",
    width: 130,
    renderCell: (params) => (
      <Chip
        size="small"
        label={params.value ? "Permanent" : "Up / down"}
        color={params.value ? "info" : "default"}
        variant={params.value ? "filled" : "outlined"}
      />
    ),
  },
  {
    field: "manual_status",
    headerName: "Status",
    width: 130,
    renderCell: (params) => <StatusChip status={params.value} />,
  },
  {
    field: "is_tender_signed",
    headerName: "Tender",
    width: 120,
    renderCell: (params) => (
      <Chip
        size="small"
        label={params.value ? "Signed" : "Not signed"}
        color={params.value ? "success" : "default"}
        variant={params.value ? "filled" : "outlined"}
      />
    ),
  },
  { field: "crew_size", headerName: "Crew", width: 90, type: "number" },
  {
    field: "has_bank_account",
    headerName: "Bank",
    width: 90,
    sortable: false,
    renderCell: (params) => (
      <Tooltip title={params.value ? "View bank accounts" : "No bank account on file"}>
        <span>
          <IconButton
            size="small"
            disabled={!params.value}
            onClick={(e) => {
              e.stopPropagation();
              params.colDef.onViewBank(params.row);
            }}
            aria-label="View bank accounts"
          >
            <AccountBalanceOutlinedIcon fontSize="small" color={params.value ? "primary" : "disabled"} />
          </IconButton>
        </span>
      </Tooltip>
    ),
  },
];

export default function MukkadamsListPage() {
  const navigate = useNavigate();
  const [directory, setDirectory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const [isPermanent, setIsPermanent] = useState(ALL);
  const [manualStatus, setManualStatus] = useState(ALL);
  const [isTenderSigned, setIsTenderSigned] = useState(ALL);
  const [selectedMukkadam, setSelectedMukkadam] = useState(null);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    mukkadamIntegrationApi
      .getMukkadamDirectory(
        {
          q: deferredQ.trim() || undefined,
          isPermanent: isPermanent === ALL ? undefined : isPermanent === "true",
          manualStatus: manualStatus === ALL ? undefined : manualStatus,
          isTenderSigned: isTenderSigned === ALL ? undefined : isTenderSigned === "true",
        },
        controller.signal,
      )
      .then((data) => {
        if (ignore) return;
        setDirectory(data.results ?? []);
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
  }, [deferredQ, isPermanent, manualStatus, isTenderSigned]);

  const columnsWithHandler = useMemo(
    () => columns.map((col) => (col.field === "has_bank_account" ? { ...col, onViewBank: setSelectedMukkadam } : col)),
    [],
  );

  return (
    <Box className="page">
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Mukkadams
      </Typography>

      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          placeholder="Search by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          size="small"
          sx={{ flex: 1, maxWidth: { md: 320 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Select size="small" value={isPermanent} onChange={(e) => setIsPermanent(e.target.value)}>
          {TEAM_TYPE_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
        <Select size="small" value={manualStatus} onChange={(e) => setManualStatus(e.target.value)}>
          {STATUS_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
        <Select size="small" value={isTenderSigned} onChange={(e) => setIsTenderSigned(e.target.value)}>
          {TENDER_SIGNED_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </Stack>

      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <Box sx={TABLE_BOX_SX}>
          <DataGrid
            autoHeight
            rows={directory ?? []}
            columns={columnsWithHandler}
            loading={loading}
            getRowId={(row) => row.mukkadam_id}
            disableRowSelectionOnClick
            onRowClick={(params) => navigate(`/mukkadams/${params.row.mukkadam_id}`, { state: { mukkadam: params.row } })}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            pageSizeOptions={[25, 50, 100]}
            sx={{
              ...TABLE_GRID_SX,
              "& .MuiDataGrid-row": { ...TABLE_GRID_SX["& .MuiDataGrid-row"], cursor: "pointer" },
            }}
          />
        </Box>
      )}

      <MukkadamBankDetailsDrawer
        mukkadam={selectedMukkadam}
        open={Boolean(selectedMukkadam)}
        onClose={() => setSelectedMukkadam(null)}
      />
    </Box>
  );
}
