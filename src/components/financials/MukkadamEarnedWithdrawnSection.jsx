// src/components/financials/MukkadamEarnedWithdrawnSection.jsx
//
// Second half of the Revenue & Profitability page — the labor-liability view:
// how much mukkadams have earned this season (completed work) vs. how
// much has actually been withdrawn/paid out (reference doc §13). The gap
// (earned - withdrawn) is money the business owes but hasn't paid yet —
// an outstanding-payable figure a founder/investor cares about alongside
// cluster-level profit, since it's cash that will leave eventually.
//
// `search` is server-side and narrows the top-level earned/withdrawn
// totals along with by_mukkadam (per the doc's own note) — it's a filter
// on the same view it summarizes, not a separate lookup, so the totals
// row updates together with the table as you type.
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  IconButton,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import { mukkadamIntegrationApi } from "../../api/mukkadamIntegrationClient";
import { formatCurrency } from "../../utils/format";
import { TABLE_BOX_SX, TABLE_GRID_SX } from "../mukkadams/tableUtils";

function StatColumn({ label, value, color }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700, color }}>
        {value}
      </Typography>
    </Box>
  );
}

const columns = [
  { field: "mukkadam_name", headerName: "Mukkadam", flex: 1.2, minWidth: 180 },
  {
    field: "earned",
    headerName: "Earned",
    flex: 1,
    minWidth: 140,
    type: "number",
    renderCell: (params) => (
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {formatCurrency(params.value)}
      </Typography>
    ),
  },
  {
    field: "withdrawn",
    headerName: "Withdrawn",
    flex: 1,
    minWidth: 140,
    type: "number",
    renderCell: (params) => (
      <Typography variant="body2" color="text.secondary">
        {formatCurrency(params.value)}
      </Typography>
    ),
  },
  {
    field: "outstanding",
    headerName: "Outstanding",
    flex: 1,
    minWidth: 140,
    sortable: false,
    renderCell: (params) => {
      const outstanding = params.row.earned - params.row.withdrawn;
      return (
        <Typography variant="body2" sx={{ fontWeight: 700, color: outstanding > 0 ? "warning.main" : "text.secondary" }}>
          {formatCurrency(outstanding)}
        </Typography>
      );
    },
  },
];

export default function MukkadamEarnedWithdrawnSection() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    mukkadamIntegrationApi
      .getMukkadamEarnedWithdrawn({ search: deferredSearch.trim() || undefined }, controller.signal)
      .then(setData)
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [deferredSearch]);

  const outstanding = useMemo(() => (data ? data.earned - data.withdrawn : 0), [data]);

  return (
    <Box sx={{ mt: 4 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
        <PaidOutlinedIcon sx={{ fontSize: 20, color: "text.secondary" }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Mukkadam Earned vs. Withdrawn
        </Typography>
        {data?.season_code && (
          <Typography variant="caption" color="text.secondary">
            ({data.season_code})
          </Typography>
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        What mukkadams have earned from completed work this season vs. what&apos;s actually been paid out —
        the gap is an outstanding labor liability, not a discrepancy.
      </Typography>

      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <>
          <TextField
            placeholder="Search mukkadam name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ mb: 2, minWidth: 260 }}
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

          {loading && !data ? (
            <Skeleton variant="rounded" height={280} />
          ) : (
            <>
              <Stack direction="row" spacing={4} sx={{ mb: 2, flexWrap: "wrap" }}>
                <StatColumn label="Total earned" value={formatCurrency(data?.earned)} color="success.main" />
                <StatColumn label="Total withdrawn" value={formatCurrency(data?.withdrawn)} color="text.primary" />
                <StatColumn
                  label="Outstanding (earned − withdrawn)"
                  value={formatCurrency(outstanding)}
                  color={outstanding > 0 ? "warning.main" : "text.primary"}
                />
              </Stack>

              <Box sx={TABLE_BOX_SX}>
                <DataGrid
                  autoHeight
                  rows={data?.by_mukkadam ?? []}
                  columns={columns}
                  loading={loading}
                  getRowId={(row) => row.mukkadam_id}
                  disableRowSelectionOnClick
                  initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                  pageSizeOptions={[10, 25, 50]}
                  sx={TABLE_GRID_SX}
                />
              </Box>
            </>
          )}
        </>
      )}
    </Box>
  );
}
