// src/pages/mukkadams/MukkadamDetailPage.jsx
//
// One mukkadam's full picture: identity + season summary on top, then
// Allocations/Payments/Maturing/Ledger as tabs below. Payments, Maturing,
// and Ledger all come straight off the payment-overview response
// (payments[]/maturity.pending[]/ledger[]) — only Allocations needs its
// own fetch, since it's a separate endpoint with its own from_date filter.
// Directory context passed via router state (village/taluka/district/
// crew_size/manual_status) is optional enrichment only — this page must
// render fine on a bare deep link with just the id.
//
// withdrawable_balance is the mukkadam's actual current wallet balance;
// max_withdrawable_amount is the (usually smaller) amount of that balance
// actually withdrawable right now after the season-earnings reserve cap —
// the Wallet balance card leads with the former and shows the latter as a
// sub-metric, never the other way around.
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Chip,
  Fade,
  IconButton,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import HourglassTopOutlinedIcon from "@mui/icons-material/HourglassTopOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import { mukkadamIntegrationApi } from "../../api/mukkadamIntegrationClient";
import { formatCurrency } from "../../utils/format";
import { useCountUp } from "../../hooks/useCountUp";
import AllocationsTable from "../../components/mukkadams/AllocationsTable";
import PaymentsTable from "../../components/mukkadams/PaymentsTable";
import LedgerTable from "../../components/mukkadams/LedgerTable";
import MaturingTable from "../../components/mukkadams/MaturingTable";
import { titleCase } from "../../components/mukkadams/tableUtils";

const TABS = ["allocations", "payments", "maturing", "ledger"];

// A plain label/value line under a summary card's headline — no meter, just
// the number, per the caption-only look the rest of these cards use.
function BreakdownRow({ label, value, color }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", mt: 0.5 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="caption" sx={{ fontWeight: 600, color: color ? `${color}.main` : "text.primary" }}>
        {formatCurrency(value)}
      </Typography>
    </Stack>
  );
}

function SummaryCard({ icon: Icon, label, value, accent, caption, onClick, children }) {
  const animated = useCountUp(typeof value === "number" ? value : 0);
  return (
    <Box
      onClick={onClick}
      sx={{
        flex: "1 1 220px",
        minWidth: 220,
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        cursor: onClick ? "pointer" : "default",
        transition: "transform 150ms ease, box-shadow 150ms ease",
        "&:hover": { transform: "translateY(-2px)", boxShadow: "0 4px 14px rgba(31,42,36,0.10)" },
      }}
    >
      <Stack direction="row" spacing={0.6} sx={{ alignItems: "center" }}>
        {Icon && <Icon sx={{ fontSize: 16, color: accent || "text.secondary" }} />}
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Stack>
      <Typography variant="h5" sx={{ fontWeight: 700, color: accent || "text.primary", lineHeight: 1.2 }}>
        {typeof value === "number" ? formatCurrency(animated) : value ?? "—"}
      </Typography>
      {caption && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
          {caption}
        </Typography>
      )}
      {children}
    </Box>
  );
}

export default function MukkadamDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const directoryContext = location.state?.mukkadam;

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const activeTab = TABS.includes(searchParams.get("tab")) ? searchParams.get("tab") : "allocations";

  const load = () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    mukkadamIntegrationApi
      .getMukkadamPaymentOverview(id, controller.signal)
      .then(setOverview)
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));
    return controller;
  };

  useEffect(() => {
    const controller = load();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const mukkadam = overview?.mukkadam;
  const summary = overview?.summary;
  const maturity = overview?.maturity;

  const initials = useMemo(() => {
    const name = mukkadam?.mukkadam_name || directoryContext?.mukkadam_name || "";
    return name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [mukkadam, directoryContext]);

  function setTab(tab) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  }

  if (error) {
    return (
      <Box className="page">
        <IconButton onClick={() => navigate("/mukkadams")} aria-label="Back to directory" sx={{ mb: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Alert
          severity="error"
          action={
            <IconButton size="small" onClick={load} aria-label="Retry">
              <RefreshOutlinedIcon fontSize="small" />
            </IconButton>
          }
        >
          Could not load this mukkadam: {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box className="page">
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
        <IconButton onClick={() => navigate("/mukkadams")} aria-label="Back to directory">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Mukkadam details
        </Typography>
      </Stack>

      {/* Identity + season header */}
      <Box
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} sx={{ mb: summary ? 2.5 : 0 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center", flex: 1 }}>
            {loading ? (
              <Skeleton variant="circular" width={56} height={56} />
            ) : (
              <Avatar sx={{ width: 56, height: 56, bgcolor: "primary.main", fontWeight: 700 }}>{initials}</Avatar>
            )}
            <Box>
              {loading ? (
                <Skeleton variant="text" width={180} height={32} />
              ) : (
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {mukkadam?.mukkadam_name || directoryContext?.mukkadam_name}
                </Typography>
              )}
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mt: 0.5, rowGap: 0.5 }}>
                {!loading && mukkadam && (
                  <>
                    <Chip
                      size="small"
                      label={mukkadam.is_permanent ? "Permanent" : "Up / down"}
                      color={mukkadam.is_permanent ? "info" : "default"}
                      variant={mukkadam.is_permanent ? "filled" : "outlined"}
                    />
                    <Chip
                      size="small"
                      label={mukkadam.is_tender_signed ? "Tender signed" : "Tender not signed"}
                      color={mukkadam.is_tender_signed ? "success" : "default"}
                      variant={mukkadam.is_tender_signed ? "filled" : "outlined"}
                    />
                    {directoryContext?.manual_status !== undefined && (
                      <Chip
                        size="small"
                        label={directoryContext.manual_status ? titleCase(directoryContext.manual_status) : "Unknown"}
                        variant="outlined"
                      />
                    )}
                    {mukkadam.mobile_numbers && (
                      <Chip size="small" icon={<PhoneOutlinedIcon />} label={mukkadam.mobile_numbers} variant="outlined" />
                    )}
                    {directoryContext && (directoryContext.village || directoryContext.taluka || directoryContext.district) && (
                      <Chip
                        size="small"
                        icon={<PlaceOutlinedIcon />}
                        label={[directoryContext.village, directoryContext.taluka, directoryContext.district]
                          .filter(Boolean)
                          .join(", ")}
                        variant="outlined"
                      />
                    )}
                  </>
                )}
              </Stack>
            </Box>
          </Stack>

          {overview?.season_code && (
            <Stack sx={{ alignItems: { md: "flex-end" } }}>
              <Typography variant="caption" color="text.secondary">
                Season
              </Typography>
              <Chip size="small" label={overview.season_code} color="primary" variant="outlined" />
            </Stack>
          )}
        </Stack>

        <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
          {loading ? (
            [0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" width={220} height={110} />)
          ) : (
            <>
              <SummaryCard
                label="Total earnings (season)"
                value={summary?.total_matured_earnings}
                caption={
                  summary?.total_earnings !== summary?.total_matured_earnings
                    ? `${formatCurrency(summary?.total_earnings)} earning after maturity`
                    : undefined
                }
              />

              <SummaryCard
                icon={AccountBalanceWalletOutlinedIcon}
                label="Wallet balance"
                value={summary?.withdrawable_balance}
                caption={mukkadam?.allow_full_withdrawal ? "Full withdrawal enabled — reserve cap bypassed" : undefined}
              >
                <BreakdownRow label="Withdrawable now" value={summary?.max_withdrawable_amount} color="success" />
              </SummaryCard>

              <SummaryCard label="Total paid out (season)" value={summary?.total_paid}>
                <BreakdownRow label="Job" value={summary?.total_paid_breakdown?.job} />
                <BreakdownRow label="Advance" value={summary?.total_paid_breakdown?.advance} />
                <BreakdownRow label="Weekly" value={summary?.total_paid_breakdown?.weekly} />
              </SummaryCard>

              <SummaryCard
                icon={HourglassTopOutlinedIcon}
                label="Maturing"
                value={maturity?.maturing_amount}
                accent="warning.main"
                caption={
                  maturity?.held_amount > 0
                    ? `${formatCurrency(maturity.held_amount)} held · ${maturity?.pending?.length ?? 0} ${
                        maturity?.pending?.length === 1 ? "entry" : "entries"
                      }`
                    : `${maturity?.pending?.length ?? 0} ${maturity?.pending?.length === 1 ? "entry" : "entries"} · click for details`
                }
                onClick={() => setTab("maturing")}
              />
            </>
          )}
        </Stack>
      </Box>

      {/* Allocations / Payments / Ledger */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setTab(v)}>
          <Tab value="allocations" label="Allocations" />
          <Tab value="payments" label={`Payments${overview?.payments ? ` (${overview.payments.length})` : ""}`} />
          <Tab value="maturing" label={`Maturing${maturity?.pending ? ` (${maturity.pending.length})` : ""}`} />
          <Tab value="ledger" label={`Ledger${overview?.ledger ? ` (${overview.ledger.length})` : ""}`} />
        </Tabs>
      </Box>

      <Fade in key={activeTab} timeout={280}>
        <Box>
          {activeTab === "allocations" && <AllocationsTable mukkadamId={id} />}
          {activeTab === "payments" && <PaymentsTable payments={overview?.payments} loading={loading} />}
          {activeTab === "maturing" && (
            <MaturingTable pending={maturity?.pending} loading={loading} mukkadamId={id} onReleased={load} />
          )}
          {activeTab === "ledger" && (
            <LedgerTable ledger={overview?.ledger} loading={loading} mukkadamId={id} onReleased={load} />
          )}
        </Box>
      </Fade>
    </Box>
  );
}
