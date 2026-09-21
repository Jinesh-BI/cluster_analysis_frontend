// src/components/mukkadams/MaturingTable.jsx
//
// Maturing tab — payment-overview.maturity.pending[], the not-yet-liquid
// earnings (still inside their 24h maturity window, or manually held with
// no ETA). "Matures in" is a live countdown recomputed from matures_at,
// not a static echo of the API's seconds_until_mature. These pending
// entries are the same underlying MukkadamLedger rows LedgerTable shows in
// "maturing"/"held" state, so can_release_early is actionable here too —
// see ReleaseEarlyModal. Of the three possible actions, only
// can_release_early gets a CTA — can_hold/can_release have no endpoint yet.
import { useMemo, useState } from "react";
import { Box, Chip, MenuItem, Select, Stack, Tooltip, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { formatCurrency } from "../../utils/format";
import { useCountdown } from "../../hooks/useCountdown";
import { useAuth } from "../../context/AuthContext";
import { ALL, ReleaseEarlyAction, TABLE_BOX_SX, TABLE_GRID_SX, titleCase, useDistinctValues } from "./tableUtils";
import ReleaseEarlyModal from "./ReleaseEarlyModal";

const STATUS_COLOR = { maturing: "warning", held: "error" };

function MaturesInCell({ row }) {
  const countdown = useCountdown(row.status === "maturing" ? row.matures_at : null);
  if (row.status === "held") {
    return (
      <Tooltip title={row.held_reason || "Held indefinitely — no ETA"}>
        <Typography variant="body2" color="error.main" sx={{ fontWeight: 600 }}>
          Held
        </Typography>
      </Tooltip>
    );
  }
  return <Typography variant="body2">{countdown ?? "—"}</Typography>;
}

const columns = [
  { field: "date", headerName: "Date", width: 110, valueGetter: (v) => v ?? "—" },
  { field: "activity", headerName: "Activity", flex: 1, minWidth: 140, valueGetter: (v) => v ?? "—" },
  { field: "plot", headerName: "Plot", flex: 1, minWidth: 130, valueGetter: (v) => v ?? "—" },
  {
    field: "amount",
    headerName: "Amount",
    width: 120,
    renderCell: (params) => (
      <Typography sx={{ fontWeight: 600, color: "warning.main" }}>{formatCurrency(params.value)}</Typography>
    ),
  },
  {
    field: "status",
    headerName: "Status",
    width: 110,
    renderCell: (params) => (
      <Chip size="small" label={titleCase(params.value)} color={STATUS_COLOR[params.value] || "default"} />
    ),
  },
  {
    field: "matures_at",
    headerName: "Matures in",
    width: 130,
    sortable: false,
    renderCell: (params) => <MaturesInCell row={params.row} />,
  },
];

export default function MaturingTable({ pending, loading, mukkadamId, onReleased }) {
  const { user } = useAuth();
  const canReleaseEarly = user?.role === "REGIONAL_MANAGER" || user?.role === "ADMIN";
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [releaseTarget, setReleaseTarget] = useState(null); // the pending entry being released, or null

  const rows = pending ?? [];
  const statusOptions = useDistinctValues(rows, "status");

  const filteredRows = useMemo(
    () => rows.filter((r) => statusFilter === ALL || r.status === statusFilter),
    [rows, statusFilter],
  );

  const columnsWithActions = useMemo(
    () => [
      ...columns,
      {
        field: "actions",
        headerName: "Valid ops actions",
        width: 160,
        sortable: false,
        renderCell: (params) => (
          <ReleaseEarlyAction
            actions={params.value}
            onClick={canReleaseEarly ? () => setReleaseTarget(params.row) : undefined}
          />
        ),
      },
    ],
    [canReleaseEarly],
  );

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2, alignItems: { md: "center" } }}>
        <Select size="small" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value={ALL}>All statuses</MenuItem>
          {statusOptions.map((v) => (
            <MenuItem key={v} value={v}>
              {titleCase(v)}
            </MenuItem>
          ))}
        </Select>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
          {filteredRows.length} of {rows.length} not-yet-liquid entries
        </Typography>
      </Stack>

      <Box sx={TABLE_BOX_SX}>
        <DataGrid
          autoHeight
          rows={filteredRows}
          columns={columnsWithActions}
          loading={loading}
          getRowId={(row) => row.id}
          disableRowSelectionOnClick
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[25, 50, 100]}
          sx={TABLE_GRID_SX}
        />
      </Box>

      <ReleaseEarlyModal
        open={Boolean(releaseTarget)}
        mukkadamId={mukkadamId}
        ledgerId={releaseTarget?.id}
        amount={releaseTarget?.amount}
        onClose={() => setReleaseTarget(null)}
        onReleased={() => {
          setReleaseTarget(null);
          onReleased?.();
        }}
      />
    </Box>
  );
}
