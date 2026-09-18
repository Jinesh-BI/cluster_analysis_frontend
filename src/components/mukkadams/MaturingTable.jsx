// src/components/mukkadams/MaturingTable.jsx
//
// Maturing tab — payment-overview.maturity.pending[], the not-yet-liquid
// earnings (still inside their 24h maturity window, or manually held with
// no ETA). "Matures in" is a live countdown recomputed from matures_at,
// not a static echo of the API's seconds_until_mature.
import { useMemo, useState } from "react";
import { Box, Chip, MenuItem, Select, Stack, Tooltip, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { formatCurrency } from "../../utils/format";
import { useCountdown } from "../../hooks/useCountdown";
import { ALL, ActionBadges, TABLE_BOX_SX, TABLE_GRID_SX, titleCase, useDistinctValues } from "./tableUtils";

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
  {
    field: "actions",
    headerName: "Valid ops actions",
    width: 140,
    sortable: false,
    renderCell: (params) => <ActionBadges actions={params.value} />,
  },
];

export default function MaturingTable({ pending, loading }) {
  const [statusFilter, setStatusFilter] = useState(ALL);

  const rows = pending ?? [];
  const statusOptions = useDistinctValues(rows, "status");

  const filteredRows = useMemo(
    () => rows.filter((r) => statusFilter === ALL || r.status === statusFilter),
    [rows, statusFilter],
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
          columns={columns}
          loading={loading}
          getRowId={(row) => row.id}
          disableRowSelectionOnClick
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[25, 50, 100]}
          sx={TABLE_GRID_SX}
        />
      </Box>
    </Box>
  );
}
