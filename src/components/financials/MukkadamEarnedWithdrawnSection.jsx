// src/components/financials/MukkadamEarnedWithdrawnSection.jsx
//
// Content for its own page (MukkadamEarnedWithdrawnPage, kept separate from
// Revenue & Profitability per request rather than a section on that page)
// — the labor-liability view: how much mukkadams have earned this season
// (completed work) vs. how much has actually been withdrawn/paid out
// (reference doc §13). The gap (earned - withdrawn) is money the business
// owes but hasn't paid yet — an outstanding-payable figure a founder/
// investor cares about alongside cluster-level profit, since it's cash
// that will leave eventually. It can also go negative (withdrawn exceeds
// earned this season) when a payment lands for work earned in a prior
// season — reference doc §13 is explicit that these are two independent
// totals, not a running balance — so that case is labeled distinctly
// ("Prior-season") rather than styled as a problem.
//
// `search` is server-side and narrows the top-level earned/withdrawn
// totals along with by_mukkadam (per the doc's own note) — it's a filter
// on the same view it summarizes, not a separate lookup, so the totals
// row, chart, and table all update together as you type.
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, IconButton, InputAdornment, Skeleton, Stack, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { DataGrid } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import TrendingFlatRoundedIcon from "@mui/icons-material/TrendingFlatRounded";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { mukkadamIntegrationApi } from "../../api/mukkadamIntegrationClient";
import { formatCurrency } from "../../utils/format";
import { TABLE_BOX_SX } from "../mukkadams/tableUtils";
import KpiTile from "./KpiTile";
import EarnedWithdrawnChart from "./EarnedWithdrawnChart";
import { outstandingMeta } from "./financialUtils";

// Same green-banner/alternating-row/hover-tint theme every other important
// DataGrid table in this app already uses (MukkadamJobsBoard,
// MukkadamInsightsTable) — this table gets it too instead of the plain
// hover-only style it had before, for "uniformality of ERP system."
const GRID_SX = {
  border: "none",
  "& .MuiDataGrid-columnHeader": {
    backgroundColor: "rgb(15, 110, 86) !important",
    color: "#ffffff",
  },
  "& .MuiDataGrid-columnHeaderTitle": {
    fontWeight: 700,
    fontSize: 11,
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  "& .MuiDataGrid-iconButtonContainer button": {
    color: "#ffffff",
  },
  "& .MuiDataGrid-sortIcon": {
    color: "rgba(255,255,255,0.7)",
  },
  "& .MuiDataGrid-row": {
    transition: "background-color 120ms ease",
  },
  "& .MuiDataGrid-row:nth-of-type(even)": {
    backgroundColor: "#f5f9f5",
  },
  "& .MuiDataGrid-row:nth-of-type(odd)": {
    backgroundColor: "#ffffff",
  },
  "& .MuiDataGrid-row:hover": {
    backgroundColor: "#e8f5e9 !important",
  },
  "& .MuiDataGrid-cell": {
    borderBottom: "1px solid #e0e0e0",
    fontSize: 13,
  },
  "& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus": {
    outline: "none",
  },
  "& .MuiDataGrid-cell:focus-within, & .MuiDataGrid-columnHeader:focus-within": {
    outline: "none",
  },
};

function ViewDetailsButton({ mukkadamId }) {
  const navigate = useNavigate();
  return (
    <Button
      size="small"
      variant="outlined"
      endIcon={<OpenInNewOutlinedIcon sx={{ fontSize: "15px !important" }} />}
      onClick={() => navigate(`/mukkadams/${mukkadamId}`)}
    >
      View
    </Button>
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
    minWidth: 160,
    sortable: false,
    renderCell: (params) => {
      const outstanding = params.row.earned - params.row.withdrawn;
      const meta = outstandingMeta(outstanding);
      return (
        <Typography variant="body2" sx={{ fontWeight: 700, color: meta.color }}>
          {meta.label}
        </Typography>
      );
    },
  },
  {
    field: "actions",
    headerName: "",
    width: 100,
    sortable: false,
    renderCell: (params) => <ViewDetailsButton mukkadamId={params.row.mukkadam_id} />,
  },
];

export default function MukkadamEarnedWithdrawnSection() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    mukkadamIntegrationApi
      .getMukkadamEarnedWithdrawn({ search: deferredSearch.trim() || undefined }, controller.signal)
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
  }, [deferredSearch]);

  const outstanding = useMemo(() => (data ? data.earned - data.withdrawn : 0), [data]);
  const byMukkadam = useMemo(() => [...(data?.by_mukkadam ?? [])].sort((a, b) => b.earned - a.earned), [data]);
  const outstandingIcon =
    outstanding > 0 ? TrendingUpRoundedIcon : outstanding < 0 ? TrendingDownRoundedIcon : TrendingFlatRoundedIcon;

  return (
    <Box>
      <Box
        sx={{
          mb: 3,
          p: 2.5,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          background: (t) => `linear-gradient(135deg, ${alpha(t.palette.info.main, 0.09)} 0%, ${alpha(t.palette.info.main, 0)} 65%)`,
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Box sx={{ display: "flex", p: 1.1, borderRadius: 2, bgcolor: "info.main", color: "common.white", flexShrink: 0 }}>
              <PaidOutlinedIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Mukkadam Earnings
              </Typography>
              <Typography variant="body2" color="text.secondary">
                What mukkadams have earned from completed work this season vs. what&apos;s actually been paid out —
                the labor payable behind cluster-level profit.
              </Typography>
            </Box>
          </Stack>
          {data?.season_code && (
            <Box
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: 999,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                fontSize: 13,
                fontWeight: 600,
                color: "text.secondary",
                flexShrink: 0,
              }}
            >
              Season {data.season_code}
            </Box>
          )}
        </Stack>
      </Box>

      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : loading && !data ? (
        <>
          <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap", mb: 3 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rounded" sx={{ flex: "1 1 220px", minWidth: 200, height: 88 }} />
            ))}
          </Stack>
          <Skeleton variant="rounded" height={240} sx={{ mb: 3 }} />
          <Skeleton variant="rounded" height={280} />
        </>
      ) : (
        <>
          <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap", mb: 3 }}>
            <KpiTile icon={PaidOutlinedIcon} label="Total earned" rawValue={data?.earned ?? 0} format={formatCurrency} color="success" hero />
            <KpiTile
              icon={AccountBalanceWalletOutlinedIcon}
              label="Total withdrawn"
              rawValue={data?.withdrawn ?? 0}
              format={formatCurrency}
            />
            <KpiTile
              icon={outstandingIcon}
              label="Outstanding (earned − withdrawn)"
              rawValue={outstanding}
              format={formatCurrency}
              color={outstanding > 0 ? "warning" : "text.primary"}
              hero={outstanding > 0}
              tooltip="Money mukkadams have earned this season but haven't been paid yet. Can go negative when a payment this season settles work earned in a prior season — that's not a discrepancy, just two independent totals."
            />
          </Stack>

          <EarnedWithdrawnChart rows={byMukkadam} />

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

          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            All mukkadams ({byMukkadam.length})
          </Typography>
          <Box sx={TABLE_BOX_SX}>
            <DataGrid
              autoHeight
              rows={byMukkadam}
              columns={columns}
              loading={loading}
              getRowId={(row) => row.mukkadam_id}
              disableRowSelectionOnClick
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              pageSizeOptions={[10, 25, 50, 100]}
              sx={GRID_SX}
            />
          </Box>
        </>
      )}
    </Box>
  );
}
