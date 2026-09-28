// src/pages/CoverageWarningsPage.jsx
//
// "Who do we need to hold work for, and who still has runway" — built on
// GET /payment-schedule/coverage/warnings/ (reference/Farmer_coverage_warning.md).
// The API hands back two overlapping lists (negative_balance_farmers,
// low_coverage_farmers — a farmer can be in both); this page merges them
// by farmer_id into one severity-ranked view instead of two tables a
// manager would have to cross-reference themselves, since the whole point
// is "at a glance, who's critical." activities_covered is the actionable
// number end to end: 0 means the vault can't fund even the next
// activity (hold everything now), 1 or 2 means exactly that many more
// activities can safely be scheduled before the same is true.
//
// The endpoint returns bare farmer_id — no name, no cluster — so identity
// renders as "Farmer #<id>" today. farmer_name/cluster_id are read
// defensively (row.farmer_name, row.cluster_id) and used automatically —
// including linking into that farmer's cluster page — the moment the
// backend response includes them; no frontend change needed then.
import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Chip,
  Link as MuiLink,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import { opsApi } from "../api/opsClient";
import { formatCurrency } from "../utils/format";
import { useCountUp } from "../hooks/useCountUp";

const COVERED_LABEL = { 0: "Hold all work", 1: "1 activity safe", 2: "2 activities safe" };
const COVERED_COLOR = { 0: "error", 1: "warning", 2: "info" };

const MANAGER_ROLE_LABEL = {
  ADMIN: "across every cluster",
  REGIONAL_MANAGER: "across every cluster you manage",
  ASSISTANT_REGIONAL_MANAGER: "in your currently assigned clusters",
};

function farmerLabel(farmer) {
  return farmer.farmer_name || `Farmer #${farmer.farmer_id}`;
}

// One farmer can appear in both API lists — merge into a single row per
// farmer_id (keeping the negative-balance flag either way it was found)
// rather than rendering the same farmer twice across two tables.
function mergeWarnings(data) {
  const byId = new Map();
  for (const f of data?.negative_balance_farmers ?? []) {
    byId.set(f.farmer_id, { ...f, is_negative_balance: true });
  }
  for (const f of data?.low_coverage_farmers ?? []) {
    const existing = byId.get(f.farmer_id);
    byId.set(f.farmer_id, {
      ...existing,
      ...f,
      is_negative_balance: existing?.is_negative_balance ?? Number(f.vault_balance) < 0,
    });
  }
  return Array.from(byId.values()).sort((a, b) => {
    if (a.activities_covered !== b.activities_covered) return a.activities_covered - b.activities_covered;
    return Number(a.vault_balance) - Number(b.vault_balance);
  });
}

function KpiTile({ icon: Icon, label, value, color = "text.primary", hero = false }) {
  const animated = useCountUp(value);
  return (
    <Box
      sx={{
        flex: "1 1 220px",
        minWidth: 200,
        p: 2.25,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: hero ? `${color}.light` : "divider",
        bgcolor: hero ? (theme) => alpha(theme.palette[color]?.main ?? theme.palette.grey[500], 0.08) : "background.paper",
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.25 }}>
        <Box
          sx={{
            display: "flex",
            p: 0.75,
            borderRadius: 1,
            bgcolor: hero ? `${color}.main` : "action.selected",
            color: hero ? "common.white" : "text.secondary",
          }}
        >
          <Icon sx={{ fontSize: 18 }} />
        </Box>
        <Typography
          variant="subtitle2"
          color="text.secondary"
          sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.7rem" }}
        >
          {label}
        </Typography>
      </Stack>
      <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: "-0.5px", color: hero ? `${color}.dark` : "text.primary" }}>
        {Math.round(animated)}
      </Typography>
    </Box>
  );
}

function WarningTable({ rows }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Farmer</TableCell>
          <TableCell>Vault balance</TableCell>
          <TableCell>Coverage</TableCell>
          <TableCell>Upcoming activities</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((f) => {
          const negative = Number(f.vault_balance) < 0;
          return (
            <TableRow
              key={f.farmer_id}
              sx={{ borderLeft: "3px solid", borderLeftColor: `${COVERED_COLOR[f.activities_covered] || "divider"}.main` }}
            >
              <TableCell>
                {f.cluster_id ? (
                  <MuiLink component={RouterLink} to={`/clusters/${f.cluster_id}`} underline="hover" sx={{ fontWeight: 600 }}>
                    {farmerLabel(f)}
                  </MuiLink>
                ) : (
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {farmerLabel(f)}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: negative ? "error.main" : "text.primary" }}>
                    {formatCurrency(f.vault_balance)}
                  </Typography>
                  {f.is_negative_balance && (
                    <Chip size="small" color="error" variant="outlined" label="Negative balance" sx={{ height: 20 }} />
                  )}
                </Stack>
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  color={COVERED_COLOR[f.activities_covered] || "default"}
                  variant={f.activities_covered === 0 ? "filled" : "outlined"}
                  label={COVERED_LABEL[f.activities_covered] ?? `${f.activities_covered} activities safe`}
                />
              </TableCell>
              <TableCell sx={{ color: "text.secondary" }}>
                {f.activities_covered} of {f.upcoming_activities_total} covered
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function Section({ icon: Icon, title, description, color, count, children }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
        <Icon sx={{ fontSize: 20, color: `${color}.main` }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Chip size="small" label={count} color={color} sx={{ height: 20, fontWeight: 700 }} />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {description}
      </Typography>
      <Box sx={{ bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        {children}
      </Box>
    </Box>
  );
}

export default function CoverageWarningsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    opsApi
      .getCoverageWarnings()
      .then((res) => {
        if (!ignore) setData(res);
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const merged = useMemo(() => mergeWarnings(data), [data]);
  const holdList = useMemo(() => merged.filter((f) => f.activities_covered === 0), [merged]);
  const limitedList = useMemo(() => merged.filter((f) => f.activities_covered > 0), [merged]);

  return (
    <Box className="page">
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Farmer Coverage Warnings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Vault balance vs. upcoming September activity costs — who needs work held, and who still has runway.
        {data?.manager_role && ` Showing farmers ${MANAGER_ROLE_LABEL[data.manager_role] || ""}.`}
      </Typography>

      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : loading && !data ? (
        <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap", mb: 3 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" sx={{ flex: "1 1 220px", minWidth: 200, height: 96 }} />
          ))}
        </Stack>
      ) : (
        <>
          <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap", mb: 3 }}>
            <KpiTile icon={BlockOutlinedIcon} label="Hold immediately" value={holdList.length} color="error" hero />
            <KpiTile
              icon={AccountBalanceWalletOutlinedIcon}
              label="Negative balance"
              value={data?.negative_balance_count ?? 0}
              color="error"
            />
            <KpiTile
              icon={WarningAmberOutlinedIcon}
              label="Limited runway (1–2 left)"
              value={limitedList.length}
              color="warning"
            />
            <KpiTile icon={PeopleAltOutlinedIcon} label="Total farmers at risk" value={merged.length} />
          </Stack>

          <Section
            icon={BlockOutlinedIcon}
            title="Hold work immediately"
            description="Vault balance can't fund even the next activity — stop scheduling new work for these farmers until they're topped up."
            color="error"
            count={holdList.length}
          >
            {holdList.length === 0 ? (
              <Typography variant="body2" color="text.disabled" sx={{ p: 2 }}>
                No farmers need an immediate hold.
              </Typography>
            ) : (
              <WarningTable rows={holdList} />
            )}
          </Section>

          <Section
            icon={WarningAmberOutlinedIcon}
            title="Limited runway"
            description="Vault balance covers only 1 or 2 more upcoming activities — plan around the cutoff shown, not just the balance."
            color="warning"
            count={limitedList.length}
          >
            {limitedList.length === 0 ? (
              <Typography variant="body2" color="text.disabled" sx={{ p: 2 }}>
                No farmers with limited runway.
              </Typography>
            ) : (
              <WarningTable rows={limitedList} />
            )}
          </Section>
        </>
      )}
    </Box>
  );
}
