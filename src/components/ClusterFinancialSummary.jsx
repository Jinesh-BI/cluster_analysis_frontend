// src/components/ClusterFinancialSummary.jsx
//
// The cluster's bottom line, sitting above the cash-flow row and costs
// list that supply its three inputs:
//
//   Revenue served  = sum of every DEBIT vault transaction across this
//                      cluster's farmers — a debit is vault money already
//                      spent to pay for a *completed* activity, i.e.
//                      value actually delivered and earned. Unspent
//                      CREDIT balance (prepaid but not yet consumed)
//                      deliberately doesn't count as earned revenue yet.
//   − Mukkadam payouts = this season's total paid to every mukkadam who
//                      worked this cluster (useClusterMukkadamPayouts).
//   − Cluster costs    = every logged operating cost (shed/travel/
//                      essentials/labor), pending or approved alike —
//                      same total the Cluster Costs card itself shows.
//   = Net profit/loss
//
// The vault's *current* balance (credit − debit, prepaid money still
// unspent) is deliberately kept OUT of that row — it isn't earned yet,
// so mixing it in would misstate profit. It's still worth showing
// (a manager legitimately wants to know how much is sitting there), so
// it renders as its own separated, neutrally-styled line below a
// divider, with a tooltip spelling out why it's excluded from the total.
import { Box, Chip, Divider, Skeleton, Stack, Tooltip, Typography } from "@mui/material";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import TrendingFlatRoundedIcon from "@mui/icons-material/TrendingFlatRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { formatCurrency } from "../utils/format";

const STATE_META = {
  profit: { label: "Profit", color: "success.main", Icon: TrendingUpRoundedIcon },
  loss: { label: "Loss", color: "error.main", Icon: TrendingDownRoundedIcon },
  neutral: { label: "Break-even", color: "text.secondary", Icon: TrendingFlatRoundedIcon },
};

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

// costTotal/costError come from useClusterCosts, called once by
// ClusterDetailPage (and shared with the top-of-page "Net value" stat
// card) rather than fetched again here.
export default function ClusterFinancialSummary({
  deployed,
  revenue,
  revenueLoading,
  vaultBalance,
  mukkadamPayout,
  mukkadamLoading,
  costTotal,
  costError,
}) {
  if (!deployed) return null;

  if (costError) {
    return (
      <Typography variant="body2" color="error" sx={{ mb: 2 }}>
        Could not load cluster costs: {costError}
      </Typography>
    );
  }

  const loading = revenueLoading || mukkadamLoading || costTotal === null;
  if (loading) {
    return <Skeleton variant="rounded" height={104} sx={{ mb: 2 }} />;
  }

  const profit = revenue - mukkadamPayout - costTotal;
  const state = profit > 0 ? "profit" : profit < 0 ? "loss" : "neutral";
  const meta = STATE_META[state];

  return (
    <Box sx={{ mb: 2, p: 2.25, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Cluster Financials
        </Typography>
        <Chip
          icon={<meta.Icon sx={{ fontSize: "16px !important", color: "inherit" }} />}
          label={`${meta.label} · ${formatCurrency(Math.abs(profit))}`}
          sx={{ bgcolor: meta.color, color: "common.white", fontWeight: 700, "& .MuiChip-icon": { color: "common.white" } }}
        />
      </Stack>

      <Stack direction="row" spacing={4} sx={{ flexWrap: "wrap" }}>
        <StatColumn label="Revenue served" value={formatCurrency(revenue)} color="success.main" />
        <StatColumn label="− Mukkadam payouts" value={formatCurrency(mukkadamPayout)} color="text.primary" />
        <StatColumn label="− Cluster costs" value={formatCurrency(costTotal)} color="text.primary" />
        <StatColumn label="= Net" value={formatCurrency(profit)} color={meta.color} />
      </Stack>

      <Divider sx={{ my: 1.5 }} />

      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        <Typography variant="caption" color="text.secondary">
          Currently in farmer vault (prepaid, unspent):
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, color: "text.secondary" }}>
          {formatCurrency(vaultBalance)}
        </Typography>
        <Tooltip
          title="Money farmers have prepaid into their vault but haven't spent on completed work yet. Not part of the profit/loss above - only money already spent on completed services (revenue served) counts there. This figure will move into revenue as it gets debited for future completed activities."
          arrow
        >
          <InfoOutlinedIcon sx={{ fontSize: 15, color: "text.disabled", cursor: "help" }} />
        </Tooltip>
      </Stack>
    </Box>
  );
}
