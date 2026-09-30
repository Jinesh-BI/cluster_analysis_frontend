// src/components/financials/EarnedWithdrawnChart.jsx
//
// "Tell distinct series apart" is the job here (Earned vs. Withdrawn per
// mukkadam), which calls for a grouped/paired bar, not a stacked
// part-to-whole bar — a stacked bar would break the moment Withdrawn
// exceeds Earned (a real, observed case: money earned in a *prior* season
// being paid out in the current one, since reference doc §13 is
// current-season-only on the earned side but not necessarily on the
// withdrawn side). Two bars per mukkadam, sharing one scale and baseline,
// handle that relationship without any geometry breaking.
//
// Vertical columns, X-axis = every mukkadam (horizontally scrollable so
// all of them stay reachable rather than capping to a "top N" and hiding
// the rest), Y-axis = amount. One combined tooltip per mukkadam carries
// name + earned + withdrawn + outstanding together, since that's the
// actual comparison a reader wants on hover, not three separate reads.
//
// Earned uses the app's existing success/green (same hue used for
// "confirmed revenue" everywhere else); Withdrawn uses info/blue — a
// neutral categorical pairing, deliberately not reusing warning/error
// (those are reserved status colors elsewhere in this app).
import { useMemo, useState } from "react";
import { Box, MenuItem, Select, Stack, Tooltip, Typography } from "@mui/material";
import { formatCurrency } from "../../utils/format";
import { outstandingMeta } from "./financialUtils";

const TRACK_HEIGHT = 200; // px — the bars' plotting area, excludes axis labels
const COLUMN_WIDTH = 76; // px — includes the gap around each mukkadam's bar pair
const BAR_WIDTH = 15; // px — each individual bar (Earned / Withdrawn)

const SORT_OPTIONS = [
  { key: "earned_desc", label: "Highest earned" },
  { key: "withdrawn_desc", label: "Highest withdrawn" },
  { key: "outstanding_desc", label: "Highest outstanding (owed)" },
  { key: "settled_first", label: "Settled first" },
  { key: "name_asc", label: "Name (A–Z)" },
];

function sortRows(rows, sortKey) {
  const copy = [...rows];
  switch (sortKey) {
    case "withdrawn_desc":
      copy.sort((a, b) => b.withdrawn - a.withdrawn);
      break;
    case "outstanding_desc":
      copy.sort((a, b) => b.earned - b.withdrawn - (a.earned - a.withdrawn));
      break;
    case "settled_first":
      copy.sort((a, b) => Math.abs(a.earned - a.withdrawn) - Math.abs(b.earned - b.withdrawn));
      break;
    case "name_asc":
      copy.sort((a, b) => a.mukkadam_name.localeCompare(b.mukkadam_name));
      break;
    case "earned_desc":
    default:
      copy.sort((a, b) => b.earned - a.earned);
  }
  return copy;
}

// Rounds a value up to a "clean" axis ceiling (1/2/5 × 10^n) so gridlines
// read as round numbers instead of an arbitrary max like 54,213.
function niceCeil(value) {
  if (value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const fraction = value / magnitude;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * magnitude;
}

function LegendDot({ color, label }) {
  return (
    <Stack direction="row" spacing={0.6} sx={{ alignItems: "center" }}>
      <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}

function BarColumn({ row, chartMax }) {
  const outstanding = row.earned - row.withdrawn;
  const meta = outstandingMeta(outstanding);
  const statusWord = outstanding > 0 ? "still owed" : outstanding < 0 ? "prior-season settlement" : "fully settled";
  const earnedHeight = Math.max(2, (row.earned / chartMax) * TRACK_HEIGHT);
  const withdrawnHeight = Math.max(2, (row.withdrawn / chartMax) * TRACK_HEIGHT);

  return (
    <Tooltip
      arrow
      title={
        <Box sx={{ py: 0.25 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>
            {row.mukkadam_name}
          </Typography>
          <Typography variant="caption" sx={{ display: "block" }}>
            Earned: {formatCurrency(row.earned)}
          </Typography>
          <Typography variant="caption" sx={{ display: "block" }}>
            Withdrawn: {formatCurrency(row.withdrawn)}
          </Typography>
          <Typography variant="caption" sx={{ display: "block" }}>
            Outstanding: {formatCurrency(outstanding)} ({statusWord})
          </Typography>
        </Box>
      }
    >
      <Stack sx={{ width: COLUMN_WIDTH, flexShrink: 0, alignItems: "center", cursor: "default" }}>
        <Stack direction="row" spacing="3px" sx={{ alignItems: "flex-end", height: TRACK_HEIGHT }}>
          <Box
            sx={{
              width: BAR_WIDTH,
              height: earnedHeight,
              bgcolor: "success.main",
              borderRadius: "3px 3px 0 0",
              transition: "height 400ms ease",
            }}
          />
          <Box
            sx={{
              width: BAR_WIDTH,
              height: withdrawnHeight,
              bgcolor: "info.main",
              borderRadius: "3px 3px 0 0",
              transition: "height 400ms ease",
            }}
          />
        </Stack>
        <Typography
          variant="caption"
          noWrap
          sx={{
            display: "block",
            width: COLUMN_WIDTH - 6,
            textAlign: "center",
            mt: 0.5,
            fontSize: 10,
            fontWeight: outstanding > 0 ? 700 : 400,
            color: meta.color,
          }}
        >
          {row.mukkadam_name}
        </Typography>
      </Stack>
    </Tooltip>
  );
}

export default function EarnedWithdrawnChart({ rows }) {
  const [sortKey, setSortKey] = useState("earned_desc");
  const sorted = useMemo(() => sortRows(rows, sortKey), [rows, sortKey]);
  const chartMax = useMemo(() => niceCeil(Math.max(1, ...rows.flatMap((r) => [r.earned, r.withdrawn]))), [rows]);
  const gridLines = [1, 0.5, 0]; // top, mid, baseline — fractions of chartMax

  return (
    <Box sx={{ p: 2.5, mb: 3, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Mukkadams — Earned vs. Withdrawn ({rows.length})
        </Typography>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Stack direction="row" spacing={2}>
            <LegendDot color="success.main" label="Earned" />
            <LegendDot color="info.main" label="Withdrawn" />
          </Stack>
          <Select size="small" value={sortKey} onChange={(e) => setSortKey(e.target.value)} sx={{ minWidth: 200 }}>
            {SORT_OPTIONS.map((opt) => (
              <MenuItem key={opt.key} value={opt.key}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </Stack>
      </Stack>

      {rows.length === 0 ? (
        <Typography variant="body2" color="text.disabled">
          No mukkadams match the current search.
        </Typography>
      ) : (
        <Box sx={{ display: "flex" }}>
          {/* Y-axis: a few clean reference ticks instead of a value on every bar */}
          <Stack sx={{ height: TRACK_HEIGHT, justifyContent: "space-between", pr: 1, flexShrink: 0 }}>
            {gridLines.map((fraction) => (
              <Typography key={fraction} variant="caption" color="text.disabled" sx={{ fontSize: 10, whiteSpace: "nowrap", transform: "translateY(-50%)" }}>
                {formatCurrency(chartMax * fraction)}
              </Typography>
            ))}
          </Stack>

          <Box sx={{ overflowX: "auto", flex: 1, pb: 1 }}>
            <Box sx={{ position: "relative" }}>
              {/* Gridlines drawn across the scrollable track so they line up with every bar, not just the visible ones */}
              <Box sx={{ position: "absolute", inset: 0, height: TRACK_HEIGHT, pointerEvents: "none" }}>
                {gridLines.map((fraction) => (
                  <Box
                    key={fraction}
                    sx={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: `${(1 - fraction) * 100}%`,
                      borderTop: "1px solid",
                      borderColor: "divider",
                    }}
                  />
                ))}
              </Box>
              <Stack direction="row" spacing={0}>
                {sorted.map((row) => (
                  <BarColumn key={row.mukkadam_id} row={row} chartMax={chartMax} />
                ))}
              </Stack>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
