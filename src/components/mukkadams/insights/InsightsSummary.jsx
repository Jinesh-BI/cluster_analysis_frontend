// src/components/mukkadams/insights/InsightsSummary.jsx
//
// Top-of-page KPI row for the Allocations Insights screen — computed over
// the FULL filtered range regardless of which mukkadam page is loaded
// (reference/am_integration_docs.md §8).
import { useMemo } from "react";
import { Box, LinearProgress, Stack, Typography, Skeleton } from "@mui/material";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import DonutLargeOutlinedIcon from "@mui/icons-material/DonutLargeOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { formatCurrency } from "../../../utils/format";
import { useCountUp } from "../../../hooks/useCountUp";
import { pct, titleCase } from "../tableUtils";

const STATUS_SWATCH = {
  work_not_started: "grey.400",
  in_progress: "info.main",
  precomplete: "warning.main",
  completed: "success.main",
};

function KpiCard({ icon: Icon, title, children, hero = false }) {
  return (
    <Box
      sx={{
        flex: "1 1 250px",
        minWidth: 240,
        p: 2.25,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: hero ? "success.light" : "divider",
        bgcolor: hero ? "success.50" : "background.paper",
        backgroundImage: hero
          ? "linear-gradient(135deg, rgba(46, 125, 50, 0.03) 0%, rgba(255, 255, 255, 0) 100%)"
          : "none",
        boxShadow: "none",
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
        <Box
          sx={{
            display: "flex",
            p: 0.75,
            borderRadius: 1,
            bgcolor: hero ? "success.main" : "action.selected",
            color: hero ? "common.white" : "text.secondary",
          }}
        >
          <Icon sx={{ fontSize: 18 }} />
        </Box>
        <Typography 
          variant="subtitle2" 
          color={hero ? "success.dark" : "text.secondary"} 
          sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.7rem" }}
        >
          {title}
        </Typography>
      </Stack>
      {children}
    </Box>
  );
}

function AmountPayableCard({ summary }) {
  const actualAmount = summary?.actual?.total_amount ?? 0;
  const plannedAmount = summary?.planned?.total_amount ?? 0;
  const animated = useCountUp(actualAmount);
  const percent = pct(actualAmount, plannedAmount);

  return (
    <KpiCard icon={PaymentsOutlinedIcon} title="Amount Payable" hero>
      <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1, color: "success.dark", letterSpacing: "-0.5px" }}>
        {formatCurrency(animated)}
      </Typography>
      
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 0.5, mb: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
          of {formatCurrency(plannedAmount)} planned
        </Typography>
        <Box 
          component="span" 
          sx={{ 
            display: "inline-flex", 
            alignItems: "center", 
            px: 0.75, 
            py: 0.2, 
            bgcolor: "success.main", 
            color: "white", 
            borderRadius: 0.75, 
            fontSize: "0.65rem", 
            fontWeight: 700 
          }}
        >
          {percent}%
        </Box>
      </Stack>

      <LinearProgress
        variant="determinate"
        value={Math.min(percent, 100)}
        color="success"
        sx={{ height: 6, borderRadius: 3, bgcolor: "rgba(46, 125, 50, 0.12)", mb: 1 }}
      />
      
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
          {summary?.actual?.total_acres ?? 0} / {summary?.planned?.total_acres ?? 0} ac executed
        </Typography>
        <TrendingUpIcon sx={{ fontSize: 14, color: "success.main" }} />
      </Stack>
    </KpiCard>
  );
}

function AllocationsCard({ summary }) {
  const totalAllocations = summary?.total_allocations ?? 0;
  const mukkadamsDeployed = summary?.mukkadams_deployed ?? 0;

  return (
    <KpiCard icon={AssignmentTurnedInOutlinedIcon} title="Allocations & Workforce">
      <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.5px", color: "text.primary" }}>
        {totalAllocations}
      </Typography>
      
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, mb: 2.25, fontWeight: 500 }}>
        Active task allocations tracked
      </Typography>

      <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: "action.hover", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          Mukkadams Deployed
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>
          {mukkadamsDeployed}
        </Typography>
      </Box>
    </KpiCard>
  );
}

function WorkStatusCard({ summary }) {
  const byStatus = summary?.by_work_status || {};
  const total = Object.values(byStatus).reduce((sum, v) => sum + (v || 0), 0);
  const statuses = ["completed", "in_progress", "work_not_started"];

  return (
    <KpiCard icon={DonutLargeOutlinedIcon} title="Work Status Mix">
      <Stack direction="row" sx={{ height: 8, borderRadius: 1, overflow: "hidden", mb: 1.5, bgcolor: "action.hover", gap: "2px" }}>
        {statuses.map((key) => {
          const value = byStatus[key] || 0;
          const width = pct(value, total);
          if (!width) return null;
          return (
            <Box
              key={key}
              sx={{
                width: `${width}%`,
                bgcolor: STATUS_SWATCH[key] || "grey.400",
              }}
            />
          );
        })}
      </Stack>

      <Stack spacing={0.6}>
        {statuses.map((key) => (
          <Stack key={key} direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: STATUS_SWATCH[key] || "grey.400" }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                {titleCase(key)}
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.primary" }}>
              {byStatus[key] || 0}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </KpiCard>
  );
}

function ActivitiesCard({ summary }) {
  const activities = useMemo(
    () => [...(summary?.activities || [])].sort((a, b) => b.allocations_count - a.allocations_count),
    [summary],
  );

  return (
    <KpiCard icon={ListAltOutlinedIcon} title="All Activities">
      {activities.length === 0 ? (
        <Box sx={{ py: 3, textAlign: "center" }}>
          <Typography variant="body2" color="text.disabled">
            No activity recorded in range.
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            maxHeight: 180,
            overflowY: "auto",
            pr: 0.5,
            "&::-webkit-scrollbar": { width: 4 },
            "&::-webkit-scrollbar-track": { background: "transparent" },
            "&::-webkit-scrollbar-thumb": { background: (t) => t.palette.divider, borderRadius: 1 },
          }}
        >
          <Stack spacing={1.25}>
            {activities.map((a) => {
              const percent = pct(a.actual?.amount, a.planned?.amount);
              return (
                <Box key={a.activity_id}>
                  <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.3 }}>
                    <Typography variant="caption" noWrap sx={{ maxWidth: 130, fontWeight: 600, color: "text.primary" }}>
                      {a.activity_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                      {a.allocations_count} · {formatCurrency(a.actual?.amount)}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(percent, 100)}
                    sx={{ 
                      height: 4, 
                      borderRadius: 1, 
                      bgcolor: "action.hover",
                      "& .MuiLinearProgress-bar": { borderRadius: 1 }
                    }}
                  />
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}
    </KpiCard>
  );
}

export default function InsightsSummary({ summary, loading }) {
  if (loading && !summary) {
    return (
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap", mb: 3 }}>
        {[0, 1, 2, 3].map((i) => (
          <Box
            key={i}
            sx={{
              flex: "1 1 250px",
              minWidth: 240,
              p: 2.25,
              borderRadius: 1.5,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            <Skeleton variant="text" width="40%" height={20} sx={{ mb: 1.5 }} />
            <Skeleton variant="rectangular" width="100%" height={40} sx={{ mb: 1, borderRadius: 1 }} />
            <Skeleton variant="text" width="60%" height={16} />
          </Box>
        ))}
      </Stack>
    );
  }

  return (
    <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap", mb: 3 }}>
      <AmountPayableCard summary={summary} />
      <AllocationsCard summary={summary} />
      <WorkStatusCard summary={summary} />
      <ActivitiesCard summary={summary} />
    </Stack>
  );
}