// src/components/mukkadams/PaymentsTable.jsx
//
// Payments tab — raw MukkadamPayment records, already included in the
// payment-overview response (payment-overview.payments), so this table
// takes rows as a prop rather than fetching anything itself.
import { useMemo, useState } from "react";
import { Box, Chip, MenuItem, Select, Stack, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { formatCurrency } from "../../utils/format";
import { ALL, TABLE_BOX_SX, TABLE_GRID_SX, formatDateTime, titleCase, useDistinctValues } from "./tableUtils";

const STATUS_COLOR = {
  completed: "success",
  pending: "warning",
  failed: "error",
  cancelled: "default",
};

function maskAccount(accountNumber) {
  if (!accountNumber) return "—";
  const last4 = accountNumber.slice(-4);
  return `••••${last4}`;
}

const columns = [
  {
    field: "payment_date",
    headerName: "Date",
    width: 110,
    valueGetter: (v) => v ?? "—",
  },
  {
    field: "amount",
    headerName: "Amount",
    width: 110,
    renderCell: (params) => <Typography sx={{ fontWeight: 600 }}>{formatCurrency(params.value)}</Typography>,
  },
  {
    field: "payment_type",
    headerName: "Type",
    width: 110,
    renderCell: (params) => <Chip size="small" label={titleCase(params.value)} variant="outlined" />,
  },
  { field: "payment_mode", headerName: "Mode", width: 130, valueGetter: (v) => titleCase(v) },
  {
    field: "status",
    headerName: "Status",
    width: 120,
    renderCell: (params) => (
      <Chip size="small" label={titleCase(params.value)} color={STATUS_COLOR[params.value] || "default"} />
    ),
  },
  { field: "transaction_id", headerName: "Transaction", flex: 1, minWidth: 130, valueGetter: (v) => v || "—" },
  {
    field: "paid_to_account",
    headerName: "Account",
    width: 120,
    valueGetter: (v) => maskAccount(v),
  },
  { field: "paid_by", headerName: "Paid by", width: 120, valueGetter: (v) => v || "—" },
  {
    field: "created_at",
    headerName: "Recorded",
    width: 170,
    valueGetter: (v) => formatDateTime(v),
  },
];

export default function PaymentsTable({ payments, loading }) {
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);

  const rows = payments ?? [];
  const statusOptions = useDistinctValues(rows, "status");
  const typeOptions = useDistinctValues(rows, "payment_type");

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (statusFilter !== ALL && r.status !== statusFilter) return false;
        if (typeFilter !== ALL && r.payment_type !== typeFilter) return false;
        return true;
      }),
    [rows, statusFilter, typeFilter],
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
        <Select size="small" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value={ALL}>All payment types</MenuItem>
          {typeOptions.map((v) => (
            <MenuItem key={v} value={v}>
              {titleCase(v)}
            </MenuItem>
          ))}
        </Select>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
          {filteredRows.length} of {rows.length} payments
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
