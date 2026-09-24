// src/components/MukkadamJobsBoard.jsx
//
// Independent widget: every mukkadam job/allocation reported by the tender
// service for a given date, with day navigation and a farmer/mukkadam name
// search. Fetches via api/tenderClient.js — a separate client from
// api/client.js since it hits a different host (tender.bharatintelligence.ai)
// with no auth header and its own response envelope.

import { useEffect, useMemo, useState, useDeferredValue } from "react";
import { usePostHog } from "@posthog/react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Grid,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import PhotoLibraryOutlinedIcon from "@mui/icons-material/PhotoLibraryOutlined";
import { localDateStr, shiftDateStr } from "../utils/dates";
import { MukkadamJobImagesDialog } from "./MukkadamJobImagesDialog";
import { tenderApi } from "../api/tenderClient";
import { track, useDebouncedTrack } from "../analytics/track";

const STATUS_TONE = {
  completed: "success",
  in_progress: "warning",
  cancelled: "default",
  work_not_started: "error"
};

// The Today/Tomorrow toggle below uses color="secondary", which the
// app-wide theme (src/theme/index.js) maps to this same brand green
// (#0f6e56) that the grid's header banner uses as a hardcoded literal —
// so both stay visually in sync without a local theme here.

// Activity names arrive as "Pruning (छाटणी)" — split the parenthetical
// local-language label onto its own line rather than showing one long
// mixed-script string.
function splitActivityLabel(name) {
  if (!name) return { main: "—", sub: null };
  const match = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(name);
  return match ? { main: match[1].trim(), sub: match[2].trim() } : { main: name, sub: null };
}

function formatClock(iso) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  })
    .format(new Date(iso))
    .replace(/AM|PM/i, (m) => m.toLowerCase());
}

function formatFullStart(iso) {
  const datePart = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
  return `${datePart}, ${formatClock(iso)}`;
}

// "Under a minute" for genuinely short jobs, otherwise a rounded
// minutes/hours readout — a job-board duration doesn't need second-level
// precision.
function humanizeDuration(startIso, endIso) {
  const ms = new Date(endIso) - new Date(startIso);
  if (ms < 60000) return "under a minute";
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}

// Shared layout for every compound (two/three-line) cell below.
const cellStackSx = { py: 1, width: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 0.3 };
const inlineChipSx = { height: 18, fontSize: 10, fontWeight: 600, width: "fit-content" };

// Seven wide, information-dense columns instead of thirteen narrow ones —
// each field is paired with its closest related detail on a second/third
// line inside the same cell, so every important fact is visible without
// horizontal scrolling on a normal desktop viewport.
const columns = [
  {
    field: "mukkadam_name",
    headerName: "Mukkadam",
    flex: 1.2,
    minWidth: 150,
    renderCell: (params) => (
      <Box sx={cellStackSx}>
        <Typography sx={{ fontSize: 13 }}>{params.row.mukkadam_name}</Typography>
        <Chip
          size="small"
          label={params.row.is_permanent ? "Permanent" : "Up/Down"}
          color={params.row.is_permanent ? "info" : "warning"}
          variant={params.row.is_permanent ? "outlined" : "outlined"}
          sx={inlineChipSx}
        />
      </Box>
    ),
  },
  {
    field: "activity_name",
    headerName: "Activity • Status",
    flex: 1.2,
    minWidth: 150,
    renderCell: (params) => {
      const { main, sub } = splitActivityLabel(params.row.activity_name);
      const status = params.row.work_status || params.row.status;
      return (
        <Box sx={cellStackSx}>
          <Grid container direction="row" sx={{ gap: 0.6, alignItems: "center" }}>
            <Typography sx={{ fontSize: 13 }}>{main}</Typography>
            {sub && (
              <Typography sx={{ fontSize: 11, color: "text.secondary" }}>({sub})</Typography>
            )}
          </Grid>
          {status && (
            <Chip
              size="small"
              label={String(status).replace(/_/g, " ")}
              color={STATUS_TONE[status] || "default"}
              variant={STATUS_TONE[status] ? "filled" : "outlined"}
              sx={inlineChipSx}
            />
          )}
        </Box>
      );
    },
  },
  {
    field: "farmer_name",
    headerName: "Farmer • Plot • Variety",
    flex: 1.3,
    minWidth: 170,
    renderCell: (params) => (
      <Box sx={cellStackSx}>
        <Typography sx={{ fontSize: 13 }}>{params.row.farmer_name || "—"}</Typography>
        <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
          {params.row.plot_name || "—"}
          {params.row.plot_variety ? ` · ${params.row.plot_variety}` : ""}
        </Typography>
      </Box>
    ),
  },
  {
    field: "actual_area_done",
    headerName: "Acres Done • Planned",
    width: 150,
    renderCell: (params) => {
      const done = params.row.actual_area_done;
      const planned = params.row.plot_acres;
      const pct = planned ? Math.min(100, ((done || 0) / planned) * 100) : 0;
      return (
        <Box sx={{ ...cellStackSx, gap: 0.6 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600 }}>
            {done == null ? "—" : done} / {planned == null ? "—" : planned} ac
          </Typography>
          {planned != null && (
            <Box sx={{ height: 4, borderRadius: 2, bgcolor: "#e2e8f0", overflow: "hidden" }}>
              <Box sx={{ height: "100%", width: `${pct}%`, bgcolor: pct >= 100 ? "#16a34a" : "#22c55e" }} />
            </Box>
          )}
        </Box>
      );
    },
  },
  {
    field: "actual_crew_size",
    headerName: "Crew",
    width: 70,
    renderCell: (params) => (
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
        {params.row.actual_crew_size ?? "—"}
      </Typography>
    ),
  },
  {
    field: "work_window",
    headerName: "Work Window",
    flex: 1.5,
    minWidth: 210,
    sortable: false,
    filterable: false,
    renderCell: (params) => {
      const { actual_start_time: start, actual_end_time: end, work_status: status } = params.row;
      if (!start) {
        return (
          <Box sx={cellStackSx}>
            <Typography sx={{ fontSize: 12 }}>—</Typography>
            <Typography sx={{ fontSize: 11, color: "text.secondary" }}>—</Typography>
          </Box>
        );
      }
      const rangeLabel = end ? `${formatFullStart(start)} → ${formatClock(end)}` : `${formatFullStart(start)} → now`;
      const durationLabel = end ? humanizeDuration(start, end) : status === "in_progress" ? "running" : "—";
      return (
        <Box sx={cellStackSx}>
          <Typography sx={{ fontSize: 12 }}>{rangeLabel}</Typography>
          <Typography sx={{ fontSize: 11, color: "text.secondary" }}>{durationLabel}</Typography>
        </Box>
      );
    },
  },
  // {
  //   field: "location",
  //   headerName: "Location",
  //   width: 90,
  //   sortable: false,
  //   filterable: false,
  //   renderCell: (params) => {
  //     const { plot_latitude: lat, plot_longitude: lng } = params.row;
  //     const hasLocation = lat != null && lng != null;
  //     if (!hasLocation) {
  //       return <Typography sx={{ fontSize: 12, color: "text.secondary" }}>No map</Typography>;
  //     }
  //     return (
  //       <Tooltip title="Plot location">
  //         <a
  //           href={`https://www.google.com/maps?q=${lat},${lng}`}
  //           target="_blank"
  //           rel="noopener noreferrer"
  //           style={{ color: "#1565c0", fontWeight: 600, fontSize: 12, textDecoration: "none" }}
  //         >
  //           Map
  //         </a>
  //       </Tooltip>
  //     );
  //   },
  // },
  {
    field: "images",
    headerName: "Evidence",
    width: 80,
    sortable: false,
    filterable: false,
    renderCell: (params) => {
      const count = params.row.images?.length ?? 0;
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Badge
            badgeContent={count}
            color="secondary"
            overlap="circular"
            invisible={count === 0}
            sx={{ "& .MuiBadge-badge": { fontSize: 9, height: 15, minWidth: 15, fontWeight: 700 } }}
          >
            <PhotoLibraryOutlinedIcon
              sx={{ fontSize: 18, color: count > 0 ? "secondary.main" : "text.disabled", cursor: count > 0 ? "pointer" : "default" }}
            />
          </Badge>
        </div>
      );
    },
  },
];

export default function MukkadamJobsBoard() {
  const posthog = usePostHog();
  const [dateStr, setDateStr] = useState(() => localDateStr(0));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [imagesRow, setImagesRow] = useState(null);

  useDebouncedTrack(posthog, "mukkadam_jobs_search_applied", search);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    tenderApi
      .getMukkadamJobs(dateStr, controller.signal)
      .then((data) => {
        if (ignore) return;
        setRows(data.results ?? []);
      })
      .catch((err) => {
        if (!ignore && err.name !== "AbortError") setError("Could not load jobs for this date.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [dateStr]);

  const filteredRows = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.farmer_name?.toLowerCase().includes(q) || r.mukkadam_name?.toLowerCase().includes(q),
    );
  }, [rows, deferredSearch]);

  // Day-level totals — always over every job fetched for the date,
  // independent of the name search, so the summary row reads as "today's
  // numbers" rather than shifting as someone types into the search box.
  const stats = useMemo(() => {
    const total = rows.length;
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    let permanent = 0;
    for (const r of rows) {
      if (r.work_status === "completed") completed++;
      else if (r.work_status === "in_progress") inProgress++;
      else if (r.work_status === "work_not_started") notStarted++;
      if (r.is_permanent) permanent++;
    }
    return { total, completed, inProgress, notStarted, permanent, upDown: total - permanent };
  }, [rows]);

  const isToday = dateStr === localDateStr(0);
  const isTomorrow = dateStr === localDateStr(1);

  return (
    <>
      <Box className="info-card">
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.25 }}>
          Job Activities
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Every mukkadam job reported for a day, with team type, status, and field capture details.
        </Typography>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          sx={{ mb: 2, alignItems: { md: "center" }, justifyContent: "space-between" }}
        >
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <IconButton
              size="small"
              disabled={loading}
              onClick={() => {
                track(posthog, "mukkadam_jobs_date_changed", { mode: "previous_day" });
                setDateStr((d) => shiftDateStr(d, -1));
              }}
              aria-label="Previous day"
            >
              <ArrowBackIosNewIcon sx={{ fontSize: 14 }} />
            </IconButton>

            <TextField
              type="date"
              size="small"
              value={dateStr}
              disabled={loading}
              onChange={(e) => {
                track(posthog, "mukkadam_jobs_date_changed", { mode: "manual" });
                setDateStr(e.target.value);
              }}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ minWidth: 150 }}
            />

            <IconButton
              size="small"
              disabled={loading}
              onClick={() => {
                track(posthog, "mukkadam_jobs_date_changed", { mode: "next_day" });
                setDateStr((d) => shiftDateStr(d, 1));
              }}
              aria-label="Next day"
            >
              <ArrowForwardIosIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Stack>

          <Stack direction="row" spacing={0.75}>
            <Button
              size="small"
              color="secondary"
              variant={isToday ? "contained" : "outlined"}
              disabled={loading}
              onClick={() => {
                track(posthog, "mukkadam_jobs_date_changed", { mode: "today" });
                setDateStr(localDateStr(0));
              }}
            >
              Today
            </Button>
            <Button
              size="small"
              color="secondary"
              variant={isTomorrow ? "contained" : "outlined"}
              disabled={loading}
              onClick={() => {
                track(posthog, "mukkadam_jobs_date_changed", { mode: "tomorrow" });
                setDateStr(localDateStr(1));
              }}
            >
              Tomorrow
            </Button>
          </Stack>

          <TextField
            placeholder="Search by farmer or mukkadam name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ flex: 1, maxWidth: { md: 380 } }}
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

          {!error && (
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <Chip size="small" label={`${stats.total} ${stats.total === 1 ? "Job" : "Jobs"}`} sx={{ fontWeight: 700 }} />
              <Chip size="small" label={`${stats.completed} Done`} color="success" variant="outlined" sx={{ fontWeight: 700 }} />
              <Chip size="small" label={`${stats.inProgress} Running`} color="warning" variant="outlined" sx={{ fontWeight: 700 }} />
              <Chip size="small" color="error" variant={stats.notStarted > 0 ? "filled" : "outlined"} label={`${stats.notStarted} Not Started`}/>
            </Stack>
          )}
        </Stack>

        {error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Box
            sx={{
              bgcolor: "background.paper",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              overflow: "hidden",
            }}
          >
            <DataGrid
              autoHeight
              rows={filteredRows}
              columns={columns}
              loading={loading}
              getRowId={(row) => row.allocation_id}
              onCellClick={(params) => {
                if (params.field === "images" && (params.row.images?.length ?? 0) > 0) {
                  track(posthog, "mukkadam_job_evidence_opened", {
                    allocation_id: params.row.allocation_id,
                    image_count: params.row.images.length,
                  });
                  setImagesRow(params.row);
                }
              }}
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              pageSizeOptions={[10, 25, 50, 100]}
              onPaginationModelChange={(model) => track(posthog, "mukkadam_jobs_page_changed", { page: model.page, page_size: model.pageSize })}
              getRowHeight={() => "auto"}
              getEstimatedRowHeight={() => 78}
              columnHeaderHeight={44}
              disableRowSelectionOnClick
              sx={{
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
                  whiteSpace: "normal",
                  lineHeight: 1.2,
                },

                /* Header icons */
                "& .MuiDataGrid-iconButtonContainer button": {
                  color: "#ffffff",
                },

                "& .MuiDataGrid-sortIcon": {
                  color: "#636161",
                },

                /* ================= ROWS ================= */

                // Even rows
                "& .MuiDataGrid-row:nth-of-type(even)": {
                  backgroundColor: "#f5f9f5",
                },

                // Odd rows
                "& .MuiDataGrid-row:nth-of-type(odd)": {
                  backgroundColor: "#ffffff",
                },

                /* Hover */
                "& .MuiDataGrid-row:hover": {
                  backgroundColor: "#e8f5e9 !important",
                },

                /* Selected row */
                "& .MuiDataGrid-row.Mui-selected": {
                  backgroundColor: "#c8e6c9",
                },

                "& .MuiDataGrid-row.Mui-selected:hover": {
                  backgroundColor: "#a5d6a7 !important",
                },

                /* ================= CELLS ================= */

                "& .MuiDataGrid-cell": {
                  borderBottom: "1px solid #e0e0e0",
                  fontSize: 8,
                },

                /* Remove focus outline */
                "& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus": {
                  outline: "none",
                },

                "& .MuiDataGrid-cell:focus-within, & .MuiDataGrid-columnHeader:focus-within": {
                  outline: "none",
                },
              }}
            />
          </Box>
        )}
      </Box>

      <MukkadamJobImagesDialog open={Boolean(imagesRow)} row={imagesRow} onClose={() => setImagesRow(null)} />
    </>
  );
}
