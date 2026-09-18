// src/components/mukkadams/AllocationsTable.jsx
//
// Allocations tab on the mukkadam detail page. from_date is the one
// server-side filter the allocations API actually supports (plus
// mukkadam_id, always applied here) — activity_name/work_status/variety
// have no server-side filter, so those are applied client-side over
// whatever from_date already narrowed down.
import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Chip, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { mukkadamIntegrationApi } from "../../api/mukkadamIntegrationClient";
import { formatCurrency } from "../../utils/format";
import { ALL, TABLE_BOX_SX, TABLE_GRID_SX, titleCase, useDistinctValues } from "./tableUtils";

const WORK_STATUS_OPTIONS = ["work_not_started", "in_progress", "precomplete", "completed"];
const WORK_STATUS_COLOR = {
  work_not_started: "default",
  in_progress: "info",
  precomplete: "warning",
  completed: "success",
};
const PAYMENT_STATUS_COLOR = {
  pending: "warning",
  dispute: "error",
  done: "success",
  settled: "primary",
};

const columns = [
  { field: "allocated_date", headerName: "Date", width: 110 },
  { field: "activity_name", headerName: "Activity", flex: 1, minWidth: 130 },
  { field: "farmer_name", headerName: "Farmer", flex: 1, minWidth: 130, valueGetter: (v) => v ?? "—" },
  {
    field: "plot",
    headerName: "Plot",
    flex: 1,
    minWidth: 140,
    valueGetter: (_, row) => [row.plot_name, row.plot_code].filter(Boolean).join(" · ") || "—",
  },
  { field: "variety", headerName: "Variety", flex: 1, minWidth: 130, valueGetter: (v) => v ?? "—" },
  {
    field: "mukkadam_rate",
    headerName: "Rate",
    width: 100,
    valueGetter: (v) => (v == null ? "—" : formatCurrency(v)),
  },
  {
    field: "allocated_area",
    headerName: "Allocated",
    width: 100,
    valueGetter: (v) => (v == null ? "—" : `${v} ac`),
  },
  {
    field: "actual_area_done",
    headerName: "Done",
    width: 90,
    valueGetter: (v) => (v == null ? "—" : `${v} ac`),
  },
  { field: "actual_crew_size", headerName: "Crew", width: 80, valueGetter: (v) => v ?? "—" },
  {
    field: "mukkadam_actual_amount",
    headerName: "Amount",
    width: 110,
    valueGetter: (v) => (v == null ? "—" : formatCurrency(v)),
  },
  {
    field: "work_status",
    headerName: "Work status",
    width: 140,
    renderCell: (params) => (
      <Chip size="small" label={titleCase(params.value)} color={WORK_STATUS_COLOR[params.value] || "default"} />
    ),
  },
  {
    field: "payment_status",
    headerName: "Payment",
    width: 120,
    renderCell: (params) => (
      <Chip size="small" label={titleCase(params.value)} color={PAYMENT_STATUS_COLOR[params.value] || "default"} />
    ),
  },
];

export default function AllocationsTable({ mukkadamId }) {
  const [fromDate, setFromDate] = useState("");
  const [appliedFromDate, setAppliedFromDate] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activityFilter, setActivityFilter] = useState(ALL);
  const [workStatusFilter, setWorkStatusFilter] = useState(ALL);
  const [varietyFilter, setVarietyFilter] = useState(ALL);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    mukkadamIntegrationApi
      .getAllocationsSince({ mukkadamId, fromDate: fromDate || undefined }, controller.signal)
      .then((data) => {
        if (ignore) return;
        setRows(data.results ?? []);
        setAppliedFromDate(data.from_date ?? null);
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
  }, [mukkadamId, fromDate]);

  const activityOptions = useDistinctValues(rows, "activity_name");
  const varietyOptions = useDistinctValues(rows, "variety");

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (activityFilter !== ALL && r.activity_name !== activityFilter) return false;
        if (workStatusFilter !== ALL && r.work_status !== workStatusFilter) return false;
        if (varietyFilter !== ALL && (r.variety ?? null) !== varietyFilter) return false;
        return true;
      }),
    [rows, activityFilter, workStatusFilter, varietyFilter],
  );

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2, alignItems: { md: "center" } }}>
        <TextField
          type="date"
          size="small"
          label="From date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 170 }}
        />
        <Select size="small" value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value={ALL}>All activities</MenuItem>
          {activityOptions.map((v) => (
            <MenuItem key={v} value={v}>
              {v}
            </MenuItem>
          ))}
        </Select>
        <Select size="small" value={workStatusFilter} onChange={(e) => setWorkStatusFilter(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value={ALL}>All work status</MenuItem>
          {WORK_STATUS_OPTIONS.map((v) => (
            <MenuItem key={v} value={v}>
              {titleCase(v)}
            </MenuItem>
          ))}
        </Select>
        <Select size="small" value={varietyFilter} onChange={(e) => setVarietyFilter(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value={ALL}>All varieties</MenuItem>
          {varietyOptions.map((v) => (
            <MenuItem key={v} value={v}>
              {v}
            </MenuItem>
          ))}
        </Select>
        {appliedFromDate && (
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
            Since {appliedFromDate} · {filteredRows.length} of {rows.length}
          </Typography>
        )}
      </Stack>

      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <Box sx={TABLE_BOX_SX}>
          <DataGrid
            autoHeight
            rows={filteredRows}
            columns={columns}
            loading={loading}
            getRowId={(row) => row.allocation_id}
            disableRowSelectionOnClick
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            pageSizeOptions={[25, 50, 100]}
            sx={TABLE_GRID_SX}
          />
        </Box>
      )}
    </Box>
  );
}
