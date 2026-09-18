// src/components/mukkadams/tableUtils.js
//
// Shared bits for the mukkadam detail page's three tab tables (Allocations,
// Payments, Ledger). None of activity_name/variety/payment status/payment
// type/ledger entry_type have a documented fixed enum or server-side
// filter — useDistinctValues builds dropdown options from whatever the
// current result set actually contains, so filtering degrades gracefully
// as new values show up rather than hardcoding a list that goes stale.
import { useMemo } from "react";
import { Stack, Tooltip, Typography } from "@mui/material";
import PauseCircleOutlinedIcon from "@mui/icons-material/PauseCircleOutlined";
import PlayCircleOutlinedIcon from "@mui/icons-material/PlayCircleOutlined";
import FastForwardOutlinedIcon from "@mui/icons-material/FastForwardOutlined";

export const ALL = "__all__";

export function pct(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export function useDistinctValues(rows, field) {
  return useMemo(() => {
    const set = new Set();
    for (const row of rows ?? []) {
      const v = row[field];
      if (v !== null && v !== undefined && v !== "") set.add(v);
    }
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
  }, [rows, field]);
}

export function titleCase(value) {
  if (!value) return "—";
  return String(value)
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// A DataGrid container box that reads consistently across all three tabs —
// same rounded/bordered frame the Mukkadams list page already uses, plus a
// gentle row hover so the tables feel alive rather than static.
export const TABLE_BOX_SX = {
  bgcolor: "background.paper",
  borderRadius: 2,
  border: "1px solid",
  borderColor: "divider",
  overflow: "hidden",
};

export const TABLE_GRID_SX = {
  border: "none",
  "& .MuiDataGrid-row": { transition: "background-color 120ms ease" },
  "& .MuiDataGrid-row:hover": { backgroundColor: (t) => t.palette.action.hover },
};

// Shared with LedgerTable and MaturingTable — both surface the same
// { can_hold, can_release, can_release_early } shape from the read-only
// integration API. Rendered as inert badges (never buttons): this API
// can't perform the mutation, so a clickable control here would lie.
const ACTION_META = {
  can_hold: { icon: PauseCircleOutlinedIcon, label: "Hold is currently a valid ops action on this entry" },
  can_release: { icon: PlayCircleOutlinedIcon, label: "Release is currently a valid ops action on this entry" },
  can_release_early: {
    icon: FastForwardOutlinedIcon,
    label: "Early release is currently a valid ops action on this entry",
  },
};

export function ActionBadges({ actions }) {
  const active = Object.entries(actions || {}).filter(([, v]) => v);
  if (active.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled">
        —
      </Typography>
    );
  }
  return (
    <Stack direction="row" spacing={0.5}>
      {active.map(([key]) => {
        const meta = ACTION_META[key];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <Tooltip key={key} title={meta.label}>
            <Icon fontSize="small" color="disabled" />
          </Tooltip>
        );
      })}
    </Stack>
  );
}
