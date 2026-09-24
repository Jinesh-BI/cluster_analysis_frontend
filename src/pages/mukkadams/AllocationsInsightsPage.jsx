// src/pages/mukkadams/AllocationsInsightsPage.jsx
//
// "Mukkadam Allocations Insight" (reference/am_integration_docs.md §8) —
// the main planned-vs-actual dashboard: an org-wide KPI summary up top,
// then a paginated, expandable per-mukkadam breakdown of every allocation
// in the selected range. Defaults to today, matching the API's own
// default — this is meant to answer "how much do we owe today" first,
// with a date range as the opt-in, not the default, view.
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { usePostHog } from "@posthog/react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import TodayOutlinedIcon from "@mui/icons-material/TodayOutlined";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import DateRangeOutlinedIcon from "@mui/icons-material/DateRangeOutlined";
import { mukkadamIntegrationApi } from "../../api/mukkadamIntegrationClient";
import { localDateStr, shiftDateStr } from "../../utils/dates";
import { ALL, WORK_STATUS_OPTIONS, titleCase } from "../../components/mukkadams/tableUtils";
// Summary KPIs / trend / leaderboard temporarily disabled per request —
// re-enable by uncommenting these imports and the JSX block below.
import InsightsSummary from "../../components/mukkadams/insights/InsightsSummary";
// import AllocationTrendChart from "../../components/mukkadams/insights/AllocationTrendChart";
// import MukkadamLeaderboard from "../../components/mukkadams/insights/MukkadamLeaderboard";
import MukkadamInsightsTable from "../../components/mukkadams/insights/MukkadamInsightsTable";
import { track, useDebouncedTrack } from "../../analytics/track";

// The insights table now paginates itself client-side (DataGrid's own
// footer, same as every other table in the app) rather than relying on
// this page's server-side page/page_size. Fetch the API's max batch
// (page_size is capped at 50 per reference/am_integration_docs.md §8) so
// that batch is almost always the full result set; the Pagination control
// below stays only for the rare case of more than 50 matching mukkadams.
const PAGE_SIZE = 50;
const TODAY = localDateStr(0);

export default function AllocationsInsightsPage() {
  const posthog = usePostHog();
  const [dateFrom, setDateFrom] = useState(TODAY);
  const [dateTo, setDateTo] = useState(TODAY);
  // Single-day nav is the default (today, shiftable ±1 day like
  // MukkadamJobsBoard's day nav) — range mode swaps that single date field
  // for separate From/To fields instead of always showing both.
  const [rangeMode, setRangeMode] = useState(false);
  const [workStatus, setWorkStatus] = useState(ALL);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Bumped after a successful "release early" (see MukkadamInsightsTable's
  // onReleased) to force the fetch effect below to re-run and pull the
  // ledger's new state, without changing any actual filter.
  const [refreshTick, setRefreshTick] = useState(0);

  const isToday = dateFrom === TODAY && dateTo === TODAY;

  useDebouncedTrack(posthog, "insights_search_applied", search);

  // Shifts the single-day nav by delta days, keeping From/To in lockstep
  // (they're the same day outside range mode).
  const shiftDay = (delta) => {
    const next = shiftDateStr(dateFrom, delta);
    track(posthog, "insights_date_changed", { mode: delta < 0 ? "previous_day" : "next_day" });
    setDateFrom(next);
    setDateTo(next);
  };

  // Flipping modes always snaps "To" to "From": entering range mode starts
  // as a zero-width range the user then widens, leaving it collapses back
  // to a single day taken from "From".
  const toggleRangeMode = () => {
    track(posthog, "insights_range_mode_toggled", { range_mode: !rangeMode });
    setDateTo(dateFrom);
    setRangeMode((r) => !r);
  };

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    mukkadamIntegrationApi
      .getAllocationsInsights(
        {
          dateFrom,
          dateTo,
          workStatus: workStatus === ALL ? undefined : workStatus,
          search: deferredSearch.trim() || undefined,
          page,
          pageSize: PAGE_SIZE,
        },
        controller.signal,
      )
      .then((res) => {
        if (ignore) return;
        setData(res);
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
  }, [dateFrom, dateTo, workStatus, deferredSearch, page, refreshTick]);

  // Any filter change should snap back to page 1 — a stale page 3 on a
  // narrower result set would just render empty.
  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, workStatus, deferredSearch]);

  const totalPages = useMemo(
    () => (data?.pagination?.count ? Math.ceil(data.pagination.count / (data.pagination.page_size || PAGE_SIZE)) : 1),
    [data],
  );

  return (
    <Box className="page">
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Mukkadam Allocations & Earnings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Planned vs. actual acres and amount, by day and by mukkadam — what&apos;s owed, and to whom.
      </Typography>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { md: "center" }, justifyContent: "space-between" }}
      >
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          {rangeMode ? (
            <>
              <TextField
                type="date"
                size="small"
                label="From"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ minWidth: 150 }}
              />
              <TextField
                type="date"
                size="small"
                label="To"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ minWidth: 150 }}
              />
            </>
          ) : (
            <>
              <IconButton size="small" onClick={() => shiftDay(-1)} aria-label="Previous day">
                <ArrowBackIosNewIcon sx={{ fontSize: 14 }} />
              </IconButton>
              <TextField
                type="date"
                size="small"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setDateTo(e.target.value);
                }}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ minWidth: 150 }}
              />
              <IconButton size="small" onClick={() => shiftDay(1)} aria-label="Next day">
                <ArrowForwardIosIcon sx={{ fontSize: 14 }} />
              </IconButton>
              <Button
                size="small"
                variant={isToday ? "contained" : "outlined"}
                startIcon={<TodayOutlinedIcon fontSize="small" />}
                onClick={() => {
                  track(posthog, "insights_date_changed", { mode: "today" });
                  setDateFrom(TODAY);
                  setDateTo(TODAY);
                }}
              >
                Today
              </Button>
            </>
          )}
          <Button
            size="small"
            variant={rangeMode ? "contained" : "outlined"}
            color={rangeMode ? "primary" : "inherit"}
            startIcon={
              rangeMode ? <TodayOutlinedIcon fontSize="small" /> : <DateRangeOutlinedIcon fontSize="small" />
            }
            onClick={toggleRangeMode}
          >
            {rangeMode ? "Single day" : "Date range"}
          </Button>
        </Stack>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ flex: 1, minWidth: 0, justifyContent: "flex-end" }}
        >
          <Select
            size="small"
            value={workStatus}
            onChange={(e) => {
              setWorkStatus(e.target.value);
              track(posthog, "insights_work_status_filter_applied", { value: e.target.value });
            }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value={ALL}>All work status</MenuItem>
            {WORK_STATUS_OPTIONS.map((v) => (
              <MenuItem key={v} value={v}>
                {titleCase(v)}
              </MenuItem>
            ))}
          </Select>
          <TextField
            placeholder="Search mukkadam name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ flex: 1, minWidth: 200, maxWidth: 360 }}
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
        </Stack>
      </Stack>

      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <>
          <InsightsSummary summary={data?.summary} loading={loading} />

          {/* <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 2fr) minmax(280px, 1fr)" },
              gap: 2,
              mb: 3,
            }}
          >
            <AllocationTrendChart />
            <MukkadamLeaderboard onSelectMukkadam={setSearch} />
          </Box> */}

          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Mukkadam breakdown
          </Typography>

          <MukkadamInsightsTable
            results={data?.results}
            loading={loading}
            onReleased={() => setRefreshTick((t) => t + 1)}
          />

          {totalPages > 1 && (
            <Stack direction="row" sx={{ justifyContent: "center", mt: 2.5 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, p) => {
                  track(posthog, "insights_pagination_changed", { page: p });
                  setPage(p);
                }}
                color="primary"
              />
            </Stack>
          )}
        </>
      )}
    </Box>
  );
}
