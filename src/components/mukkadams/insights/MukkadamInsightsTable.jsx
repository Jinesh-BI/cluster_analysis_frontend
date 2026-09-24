// src/components/mukkadams/insights/MukkadamInsightsTable.jsx
//
// Per-mukkadam breakdown as a master-detail split (Gmail/Slack-style)
// instead of a DataGrid + overlay drawer: a narrow ranked list on the
// left, a persistent detail pane on the right that updates as you click
// through mukkadams. This replaced the earlier full-width DataGrid, which
// stretched five sparse columns across the whole page and left most of
// the row empty — here the width buys two useful panels at once, and the
// list's own mini progress bar reads "how much is owed" as a shape, not
// just digits, without waiting for a drawer to slide in.
//
// Each allocation's per-row action is the same "release early" CTA as the
// Mukkadam Detail page's Maturing tab (ReleaseEarlyAction + ReleaseEarlyModal,
// reused as-is) rather than a link away to the ledger — a regional manager
// can act on a maturing earning right from this breakdown. Eligibility
// mirrors reference/am_integration_docs.md §8's own note: only
// `allocation.ledger.state === "maturing"` can be released early (held/
// early_released/released/matured/no-ledger-yet all show the same
// disabled "—" ReleaseEarlyAction already renders for ineligible rows).
import { useEffect, useState } from "react";
import { usePostHog } from "@posthog/react";
import { Box, Chip, Divider, Stack, Typography } from "@mui/material";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import { track } from "../../../analytics/track";
import { useAuth } from "../../../context/AuthContext";
import { formatCurrency } from "../../../utils/format";
import { TABLE_BOX_SX, PAYMENT_STATUS_COLOR, ReleaseEarlyAction, WORK_STATUS_COLOR, pct, titleCase } from "../tableUtils";
import ReleaseEarlyModal from "../ReleaseEarlyModal";

const LIST_WIDTH = 320;
const PANE_MAX_HEIGHT = 560;

function completionColor(percent) {
  if (percent >= 80) return "success";
  if (percent >= 40) return "warning";
  return "default";
}

function completionBarColor(percent) {
  if (percent >= 80) return "success.main";
  if (percent >= 40) return "warning.main";
  return "text.disabled";
}

function MukkadamListRow({ mukkadam, selected, onClick }) {
  const percent = pct(mukkadam.actual?.total_amount, mukkadam.planned?.total_amount);
  return (
    <Box
      onClick={onClick}
      sx={{
        px: 1.75,
        py: 1.25,
        cursor: "pointer",
        borderLeft: "3px solid",
        borderLeftColor: selected ? "primary.main" : "transparent",
        bgcolor: selected ? "action.selected" : "transparent",
        transition: "background-color 120ms ease",
        "&:hover": { bgcolor: selected ? "action.selected" : "action.hover" },
      }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline", gap: 1 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: selected ? 700 : 600, minWidth: 0 }}>
          {mukkadam.mukkadam_name}
        </Typography>
        <Chip size="small" label={mukkadam.total_allocations ?? 0} sx={{ height: 18, fontSize: 10, flexShrink: 0 }} />
      </Stack>

      <Stack direction="row" sx={{ justifyContent: "right", alignItems: "baseline", mt: 0.25 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: "success.main" }}>
          {formatCurrency(mukkadam.actual?.total_amount)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          / {formatCurrency(mukkadam.planned?.total_amount)}
        </Typography>
      </Stack>

      <Box sx={{ height: 5, borderRadius: 2, bgcolor: "action.hover", overflow: "hidden", mt: 0.6 }}>
        <Box
          sx={{
            height: "100%",
            width: `${percent}%`,
            bgcolor: completionBarColor(percent),
            transition: "width 300ms ease",
          }}
        />
      </Box>

      <Stack direction="row" sx={{ justifyContent: "space-between", mt: 0.4 }}>
        <Typography variant="caption" color="text.secondary">
          {mukkadam.actual?.total_acres ?? 0} / {mukkadam.planned?.total_acres ?? 0} ac
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {percent}%
        </Typography>
      </Stack>
    </Box>
  );
}

function AllocationRow({ allocation, mukkadamId, canReleaseEarly, onRequestRelease }) {
  const ledger = allocation.ledger;
  const eligible = canReleaseEarly && ledger?.state === "maturing";

  return (
    <Box sx={{ py: 1.25, borderTop: "1px solid", borderColor: "divider" }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {allocation.activity_name}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }} noWrap>
            {[allocation.plot_code, allocation.farmer_name].filter(Boolean).join(" · ") || "—"} · {allocation.allocated_date}
          </Typography>
        </Box>
        <ReleaseEarlyAction
          actions={{ can_release_early: eligible }}
          onClick={
            eligible
              ? () => onRequestRelease({ mukkadamId, ledgerId: ledger.ledger_id, amount: ledger.amount })
              : undefined
          }
        />
      </Stack>

      <Stack direction="row" spacing={0.75} sx={{ mt: 0.5 }}>
        <Chip
          size="small"
          label={titleCase(allocation.work_status)}
          color={WORK_STATUS_COLOR[allocation.work_status] || "default"}
          sx={{ height: 20 }}
        />
        <Chip
          size="small"
          variant="outlined"
          label={titleCase(allocation.payment_status)}
          color={PAYMENT_STATUS_COLOR[allocation.payment_status] || "default"}
          sx={{ height: 20 }}
        />
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mt: 0.75 }}>
        <Typography variant="caption" color="text.secondary">
          Amount{" "}
          <Box component="span" sx={{ fontWeight: 700, color: "success.main" }}>
            {formatCurrency(allocation.actual?.amount)}
          </Box>{" "}
          / {formatCurrency(allocation.planned?.amount)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Area {allocation.actual?.area ?? "—"} / {allocation.planned?.area ?? "—"} ac
        </Typography>
      </Stack>
    </Box>
  );
}

function MukkadamDetailPane({ mukkadam, canReleaseEarly, onRequestRelease }) {
  const count = mukkadam.total_allocations ?? 0;
  const percent = pct(mukkadam.actual?.total_amount, mukkadam.planned?.total_amount);

  return (
    <>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", alignItems: { sm: "flex-start" }, gap: 1.5, mb: 2 }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {mukkadam.mukkadam_name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {count} allocation{count === 1 ? "" : "s"} in this range
          </Typography>
        </Box>
        <Chip
          label={`${percent}% complete`}
          color={completionColor(percent)}
          variant={percent >= 80 ? "filled" : "outlined"}
        />
      </Stack>

      <Stack direction="row" spacing={4} sx={{ mb: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Amount
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {formatCurrency(mukkadam.actual?.total_amount)}
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.75, fontWeight: 400 }}>
              / {formatCurrency(mukkadam.planned?.total_amount)}
            </Typography>
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Acres
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {mukkadam.actual?.total_acres ?? 0}
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.75, fontWeight: 400 }}>
              / {mukkadam.planned?.total_acres ?? 0}
            </Typography>
          </Typography>
        </Box>
      </Stack>

      <Divider sx={{ mb: 1 }} />

      {(mukkadam.allocations || []).length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ mt: 1.5 }}>
          No individual allocation detail for this row.
        </Typography>
      ) : (
        mukkadam.allocations.map((a) => (
          <AllocationRow
            key={a.allocation_id}
            allocation={a}
            mukkadamId={mukkadam.mukkadam_id}
            canReleaseEarly={canReleaseEarly}
            onRequestRelease={onRequestRelease}
          />
        ))
      )}
    </>
  );
}

export default function MukkadamInsightsTable({ results, loading, onReleased }) {
  const posthog = usePostHog();
  const { user } = useAuth();
  const canReleaseEarly = user?.role === "REGIONAL_MANAGER" || user?.role === "ADMIN";
  const [selectedId, setSelectedId] = useState(null);
  const [releaseTarget, setReleaseTarget] = useState(null); // { mukkadamId, ledgerId, amount } | null

  function handleSelectMukkadam(mukkadamId) {
    track(posthog, "mukkadam_breakdown_selected", { mukkadam_id: mukkadamId });
    setSelectedId(mukkadamId);
  }

  function handleRequestRelease(target) {
    track(posthog, "release_early_opened", {
      mukkadam_id: target.mukkadamId,
      ledger_id: target.ledgerId,
      source: "insights_table",
    });
    setReleaseTarget(target);
  }

  // Keep the selection valid as the result set changes underneath it
  // (new date/filter fetch) — fall back to the first mukkadam rather than
  // leaving the detail pane pointed at a row that no longer exists.
  useEffect(() => {
    if (!results || results.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!results.some((r) => r.mukkadam_id === selectedId)) {
      setSelectedId(results[0].mukkadam_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  const selected = results?.find((r) => r.mukkadam_id === selectedId) ?? null;

  if (!loading && (!results || results.length === 0)) {
    return (
      <Box sx={{ ...TABLE_BOX_SX, p: 4, textAlign: "center" }}>
        <Typography color="text.disabled">No mukkadams match the current filters.</Typography>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ ...TABLE_BOX_SX, display: "flex", flexDirection: { xs: "column", md: "row" } }}>
        <Box
          sx={{
            width: { xs: "100%", md: LIST_WIDTH },
            flexShrink: 0,
            borderRight: { md: "1px solid" },
            borderBottom: { xs: "1px solid", md: "none" },
            borderColor: "divider",
            maxHeight: { xs: 320, md: PANE_MAX_HEIGHT },
            overflowY: "auto",
          }}
        >
          {(results ?? []).map((r) => (
            <MukkadamListRow
              key={r.mukkadam_id}
              mukkadam={r}
              selected={r.mukkadam_id === selectedId}
              onClick={() => handleSelectMukkadam(r.mukkadam_id)}
            />
          ))}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, p: 2.5, maxHeight: { md: PANE_MAX_HEIGHT }, overflowY: "auto" }}>
          {selected ? (
            <MukkadamDetailPane
              mukkadam={selected}
              canReleaseEarly={canReleaseEarly}
              onRequestRelease={handleRequestRelease}
            />
          ) : (
            <Stack sx={{ alignItems: "center", justifyContent: "center", height: "100%", py: 6, color: "text.disabled" }}>
              <InsightsOutlinedIcon sx={{ fontSize: 32, mb: 1 }} />
              <Typography color="text.disabled">Select a mukkadam to see its breakdown.</Typography>
            </Stack>
          )}
        </Box>
      </Box>

      <ReleaseEarlyModal
        open={Boolean(releaseTarget)}
        mukkadamId={releaseTarget?.mukkadamId}
        ledgerId={releaseTarget?.ledgerId}
        amount={releaseTarget?.amount}
        source="insights_table"
        onClose={() => setReleaseTarget(null)}
        onReleased={() => {
          setReleaseTarget(null);
          onReleased?.();
        }}
      />
    </>
  );
}
