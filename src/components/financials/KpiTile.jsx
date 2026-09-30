// src/components/financials/KpiTile.jsx
//
// Shared stat-tile used across every Finance-category page (Revenue &
// Profitability, Mukkadam Earnings) — extracted so the two pages can't
// visually drift apart over time. Takes rawValue + format (rather than a
// pre-formatted string) so every tile counts up from 0 on load via
// useCountUp — the same "numbers feel alive" touch InsightsSummary/
// CoverageWarningsPage use elsewhere in the app.
import { Box, Stack, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useCountUp } from "../../hooks/useCountUp";

export default function KpiTile({
  icon: Icon,
  label,
  rawValue,
  format = (v) => v,
  color = "text.primary",
  hero = false,
  big = false,
  tooltip,
}) {
  const animated = useCountUp(rawValue);
  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        flex: big ? "1 1 280px" : "1 1 200px",
        minWidth: big ? 260 : 190,
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: hero ? `${color}.light` : "divider",
        bgcolor: hero ? (t) => alpha(t.palette[color]?.main ?? t.palette.grey[500], 0.06) : "background.paper",
        transition: "box-shadow 160ms ease",
        "&:hover": { boxShadow: (t) => `0 4px 14px ${alpha(t.palette.common.black, 0.08)}` },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          bgcolor: hero ? `${color}.main` : "transparent",
        }}
      />
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
        <Box
          sx={{
            display: "flex",
            p: 0.65,
            borderRadius: 1,
            bgcolor: hero ? `${color}.main` : "action.selected",
            color: hero ? "common.white" : "text.secondary",
          }}
        >
          <Icon sx={{ fontSize: 16 }} />
        </Box>
        <Typography
          variant="subtitle2"
          color="text.secondary"
          sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, fontSize: "0.66rem" }}
        >
          {label}
        </Typography>
        {tooltip && (
          <Tooltip title={tooltip}>
            <InfoOutlinedIcon sx={{ fontSize: 13, color: "text.disabled", cursor: "help" }} />
          </Tooltip>
        )}
      </Stack>
      <Typography variant={big ? "h4" : "h6"} sx={{ fontWeight: 800, color: hero ? `${color}.dark` : "text.primary" }}>
        {format(animated)}
      </Typography>
    </Box>
  );
}
