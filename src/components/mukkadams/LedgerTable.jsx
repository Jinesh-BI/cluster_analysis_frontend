// src/components/mukkadams/LedgerTable.jsx
//
// Ledger tab — every MukkadamLedger entry this season, from
// payment-overview.ledger (no separate fetch). `actions` (can_hold /
// can_release / can_release_early) are rendered as read-only badges, not
// buttons — this integration API is read-only end to end (see docs), so
// showing them as clickable would imply a mutation this page can't do.
import { useMemo, useState } from "react";
import { Box, Chip, MenuItem, Select, Stack, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { formatCurrency } from "../../utils/format";
import { ALL, ActionBadges, TABLE_BOX_SX, TABLE_GRID_SX, formatDateTime, titleCase, useDistinctValues } from "./tableUtils";

const STATE_COLOR = {
  held: "error",
  maturing: "warning",
  early_released: "info",
  released: "success",
  matured: "success",
};

const columns = [
  { field: "created_at", headerName: "Date", width: 170, valueGetter: (v) => formatDateTime(v) },
  {
    field: "entry_type",
    headerName: "Entry type",
    width: 150,
    renderCell: (params) => <Chip size="small" label={titleCase(params.value)} variant="outlined" />,
  },
  {
    field: "type",
    headerName: "Direction",
    width: 120,
    renderCell: (params) => {
      const isCredit = params.value === "CREDIT";
      const Icon = isCredit ? ArrowUpwardIcon : ArrowDownwardIcon;
      return (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", color: isCredit ? "success.main" : "error.main" }}>
          <Icon sx={{ fontSize: 16 }} />
          <Typography variant="body2" sx={{ fontWeight: 600, color: "inherit" }}>
            {titleCase(params.value)}
          </Typography>
        </Stack>
      );
    },
  },
  {
    field: "amount",
    headerName: "Amount",
    width: 120,
    renderCell: (params) => (
      <Typography sx={{ fontWeight: 600, color: params.row.type === "CREDIT" ? "success.main" : "error.main" }}>
        {formatCurrency(params.value)}
      </Typography>
    ),
  },
  { field: "description", headerName: "Description", flex: 1.4, minWidth: 200, valueGetter: (v) => v || "—" },
  {
    field: "balance_after",
    headerName: "Balance after",
    width: 130,
    valueGetter: (v) => formatCurrency(v),
  },
  {
    field: "state",
    headerName: "State",
    width: 130,
    renderCell: (params) =>
      params.value ? (
        <Chip size="small" label={titleCase(params.value)} color={STATE_COLOR[params.value] || "default"} />
      ) : (
        <Typography variant="body2" color="text.disabled">
          —
        </Typography>
      ),
  },
  {
    field: "matures_at",
    headerName: "Matures at",
    width: 170,
    valueGetter: (v) => (v ? formatDateTime(v) : "—"),
  },
  {
    field: "actions",
    headerName: "Valid ops actions",
    width: 130,
    sortable: false,
    renderCell: (params) => <ActionBadges actions={params.value} />,
  },
];

export default function LedgerTable({ ledger, loading }) {
  const [entryTypeFilter, setEntryTypeFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);

  const rows = ledger ?? [];
  const entryTypeOptions = useDistinctValues(rows, "entry_type");

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (entryTypeFilter !== ALL && r.entry_type !== entryTypeFilter) return false;
        if (typeFilter !== ALL && r.type !== typeFilter) return false;
        return true;
      }),
    [rows, entryTypeFilter, typeFilter],
  );

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2, alignItems: { md: "center" } }}>
        <Select size="small" value={entryTypeFilter} onChange={(e) => setEntryTypeFilter(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value={ALL}>All entry types</MenuItem>
          {entryTypeOptions.map((v) => (
            <MenuItem key={v} value={v}>
              {titleCase(v)}
            </MenuItem>
          ))}
        </Select>
        <Select size="small" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value={ALL}>Credit &amp; debit</MenuItem>
          <MenuItem value="CREDIT">Credit only</MenuItem>
          <MenuItem value="DEBIT">Debit only</MenuItem>
        </Select>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
          {filteredRows.length} of {rows.length} entries
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
