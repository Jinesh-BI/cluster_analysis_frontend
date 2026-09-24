// src/components/mukkadams/insights/MukkadamLeaderboard.jsx
//
// Top mukkadams for the current month (endpoint 10's own default range —
// reference/am_integration_docs.md §10), ranked by whichever metric is
// selected. Ranking always reflects `actual` figures server-side, never
// planned, matching the doc's own note. Clicking a row is a cheap
// cross-link into the main breakdown below: it just sets the parent's
// name search, no separate fetch or navigation needed.
import { useEffect, useState } from "react";
import { Box, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { mukkadamIntegrationApi } from "../../../api/mukkadamIntegrationClient";
import { formatCurrency } from "../../../utils/format";

const METRIC_LABEL = { amount: "Amount", acres: "Acres", allocations: "Jobs" };
const RANK_COLOR = { 1: "#c9a227", 2: "#9aa5ad", 3: "#b5714a" };

function metricValue(entry, metric) {
  if (metric === "allocations") return entry.total_allocations ?? 0;
  if (metric === "acres") return entry.actual?.total_acres ?? 0;
  return entry.actual?.total_amount ?? 0;
}

function formatMetricValue(value, metric) {
  if (metric === "acres") return `${value} ac`;
  if (metric === "allocations") return `${value}`;
  return formatCurrency(value);
}

export default function MukkadamLeaderboard({ onSelectMukkadam }) {
  const [metric, setMetric] = useState("amount");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    mukkadamIntegrationApi
      .getMukkadamLeaderboard({ metric, limit: 8 }, controller.signal)
      .then((data) => setResults(data.results || []))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [metric]);

  const maxValue = Math.max(1, ...results.map((r) => metricValue(r, metric)));

  return (
    <Box sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper", height: "100%" }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Leaderboard · this month
        </Typography>
        <ToggleButtonGroup size="small" value={metric} exclusive onChange={(_, v) => v && setMetric(v)}>
          {Object.entries(METRIC_LABEL).map(([key, label]) => (
            <ToggleButton key={key} value={key}>
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {error ? (
        <Typography color="error" variant="body2">
          {error}
        </Typography>
      ) : loading ? (
        <Stack spacing={1}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={34} />
          ))}
        </Stack>
      ) : results.length === 0 ? (
        <Typography color="text.disabled" variant="body2">
          No activity this month.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {results.map((r) => {
            const value = metricValue(r, metric);
            const width = Math.max(4, Math.round((value / maxValue) * 100));
            return (
              <Box
                key={r.mukkadam_id}
                onClick={() => onSelectMukkadam?.(r.mukkadam_name)}
                sx={{
                  cursor: onSelectMukkadam ? "pointer" : "default",
                  p: 0.75,
                  borderRadius: 1,
                  transition: "background-color 120ms ease",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.4 }}>
                  <Box
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#fff",
                      bgcolor: RANK_COLOR[r.rank] || "text.disabled",
                      flexShrink: 0,
                    }}
                  >
                    {r.rank}
                  </Box>
                  <Typography variant="body2" noWrap sx={{ flex: 1, fontWeight: r.rank <= 3 ? 600 : 400 }}>
                    {r.mukkadam_name}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                    {formatMetricValue(value, metric)}
                  </Typography>
                </Stack>
                <Box sx={{ height: 4, borderRadius: 2, bgcolor: (t) => t.palette.action.hover, overflow: "hidden" }}>
                  <Box sx={{ height: "100%", width: `${width}%`, bgcolor: "primary.main", transition: "width 300ms ease" }} />
                </Box>
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
