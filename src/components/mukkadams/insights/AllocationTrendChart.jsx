// src/components/mukkadams/insights/AllocationTrendChart.jsx
//
// Custom inline-SVG line chart (no charting library in this project) for
// endpoint 9 (reference/am_integration_docs.md §9). Two series sharing one
// axis (never dual-axis): Actual as the primary solid line (the same
// success-green used for "amount payable" everywhere else on this page),
// Planned as a muted dashed reference line — color follows what the line
// means, not an arbitrary palette slot. Hover shows both values for the
// nearest period via an SVG-percentage-positioned tooltip, so it needs no
// pixel measurement/ResizeObserver to track the chart's rendered size.
import { useEffect, useMemo, useState } from "react";
import { Box, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { mukkadamIntegrationApi } from "../../../api/mukkadamIntegrationClient";
import { formatCurrency } from "../../../utils/format";

const W = 600;
const H = 220;
const PAD = { top: 16, right: 12, bottom: 26, left: 44 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

// `daily` needs a real 30-day window to be worth charting; weekly/monthly
// need a proportionally wider window or you'd only ever see 1-2 buckets.
function computeRange(granularity) {
  const to = new Date();
  const from = new Date(to);
  if (granularity === "monthly") from.setMonth(from.getMonth() - 6);
  else if (granularity === "weekly") from.setDate(from.getDate() - 84);
  else from.setDate(from.getDate() - 29);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { dateFrom: fmt(from), dateTo: fmt(to) };
}

function formatCompact(n) {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n || 0);
}

function formatPeriodLabel(iso, granularity) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  if (granularity === "monthly") return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function AllocationTrendChart() {
  const [granularity, setGranularity] = useState("daily");
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setHoverIndex(null);
    mukkadamIntegrationApi
      .getAllocationTrend({ ...computeRange(granularity), granularity }, controller.signal)
      .then((data) => setSeries(data.series || []))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [granularity]);

  const maxValue = useMemo(() => {
    const values = series.flatMap((p) => [p.planned?.amount || 0, p.actual?.amount || 0]);
    return Math.max(1, ...values);
  }, [series]);

  const points = useMemo(() => {
    if (series.length === 0) return [];
    const step = series.length > 1 ? PLOT_W / (series.length - 1) : 0;
    return series.map((p, i) => ({
      x: PAD.left + step * i,
      plannedY: PAD.top + PLOT_H - ((p.planned?.amount || 0) / maxValue) * PLOT_H,
      actualY: PAD.top + PLOT_H - ((p.actual?.amount || 0) / maxValue) * PLOT_H,
      raw: p,
    }));
  }, [series, maxValue]);

  const bandWidth = points.length > 1 ? PLOT_W / (points.length - 1) : PLOT_W;
  const plannedPoly = points.map((p) => `${p.x},${p.plannedY}`).join(" ");
  const actualPoly = points.map((p) => `${p.x},${p.actualY}`).join(" ");
  const hovered = hoverIndex != null ? points[hoverIndex] : null;
  const labelStride = points.length > 8 ? Math.ceil(points.length / 8) : 1;

  return (
    <Box sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Allocation trend
        </Typography>
        <ToggleButtonGroup size="small" value={granularity} exclusive onChange={(_, v) => v && setGranularity(v)}>
          <ToggleButton value="daily">Daily</ToggleButton>
          <ToggleButton value="weekly">Weekly</ToggleButton>
          <ToggleButton value="monthly">Monthly</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
        <Stack direction="row" spacing={0.6} sx={{ alignItems: "center" }}>
          <Box sx={{ width: 14, height: 2, bgcolor: "success.main" }} />
          <Typography variant="caption" color="text.secondary">
            Actual
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.6} sx={{ alignItems: "center" }}>
          <Box sx={{ width: 14, height: 0, borderTop: "2px dashed", borderColor: "text.disabled" }} />
          <Typography variant="caption" color="text.secondary">
            Planned
          </Typography>
        </Stack>
      </Stack>

      {error ? (
        <Typography color="error" variant="body2">
          {error}
        </Typography>
      ) : loading ? (
        <Box sx={{ height: H, bgcolor: "action.hover", borderRadius: 1 }} />
      ) : points.length === 0 ? (
        <Typography color="text.disabled" variant="body2" sx={{ py: 4, textAlign: "center" }}>
          No allocations in this range.
        </Typography>
      ) : (
        <Box sx={{ position: "relative", height: H, color: "text.secondary" }}>
          <svg
            data-testid="trend-chart-svg"
            width="100%"
            height="100%"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            style={{ display: "block", overflow: "visible" }}
          >
            {[0, 0.5, 1].map((f) => {
              const y = PAD.top + PLOT_H * (1 - f);
              return (
                <g key={f}>
                  <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.1} strokeWidth={1} />
                  <text x={PAD.left - 6} y={y + 3} fontSize="9" textAnchor="end" fill="currentColor" opacity={0.6}>
                    {formatCompact(maxValue * f)}
                  </text>
                </g>
              );
            })}

            <polyline points={plannedPoly} fill="none" stroke="currentColor" strokeOpacity={0.4} strokeWidth={2} strokeDasharray="4 3" />
            <polyline points={actualPoly} fill="none" stroke="#3f8f5f" strokeWidth={2} />

            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.actualY} r={i === hoverIndex ? 4 : 2.5} fill="#3f8f5f" style={{ transition: "r 120ms ease" }} />
            ))}

            {hovered && (
              <line x1={hovered.x} x2={hovered.x} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="currentColor" strokeOpacity={0.18} />
            )}

            {points.map((p, i) => (
              <rect
                key={i}
                x={p.x - bandWidth / 2}
                y={PAD.top}
                width={bandWidth}
                height={PLOT_H}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex((v) => (v === i ? null : v))}
                style={{ cursor: "pointer" }}
              />
            ))}

            {points
              .filter((_, i) => i % labelStride === 0)
              .map((p) => (
                <text key={p.raw.period_start} x={p.x} y={H - 8} fontSize="9" textAnchor="middle" fill="currentColor" opacity={0.6}>
                  {formatPeriodLabel(p.raw.period_start, granularity)}
                </text>
              ))}
          </svg>

          {hovered && (
            <Box
              sx={{
                position: "absolute",
                left: `${(hovered.x / W) * 100}%`,
                top: `${(Math.min(hovered.plannedY, hovered.actualY) / H) * 100}%`,
                transform: "translate(-50%, -115%)",
                bgcolor: "primary.dark",
                color: "#fff",
                borderRadius: 1,
                px: 1,
                py: 0.5,
                fontSize: 11,
                lineHeight: 1.5,
                whiteSpace: "nowrap",
                pointerEvents: "none",
                boxShadow: 2,
                zIndex: 1,
              }}
            >
              <strong>{formatPeriodLabel(hovered.raw.period_start, granularity)}</strong>
              <br />
              Actual {formatCurrency(hovered.raw.actual?.amount)}
              <br />
              Planned {formatCurrency(hovered.raw.planned?.amount)}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
