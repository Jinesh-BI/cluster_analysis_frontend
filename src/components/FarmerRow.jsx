// src/components/FarmerRow.jsx
//
// One farmer's payment/activity detail, collapsed by default — an MUI
// Accordion instead of the old custom <button>+<div> toggle, so it's a
// real disclosure widget (keyboard/AA behavior for free) rather than a
// hand-rolled one. Header stays glanceable even collapsed (name, phone,
// plot/activity counts, funded/shortage chip) so a manager scanning the
// list doesn't have to open every row to see who's at risk; opening one
// reveals the data in the order a manager actually reasons about it —
// "can they afford what's coming" (coverage) before "what have they
// already been paid" (booking/payments) before "what's been done"
// (booked activities) — each its own clearly labeled section rather than
// one flat run-on list.
import { useEffect, useRef, useState } from "react";
import { usePostHog } from "@posthog/react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import LandscapeOutlinedIcon from "@mui/icons-material/LandscapeOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import { api } from "../api/client";
import { formatCurrency } from "../utils/format";
import { track, trackException } from "../analytics/track";

// Same semantic groupings the old .status-pill--* classes encoded
// (paid/booked = green family, partial/pending = amber, overdue/failed/
// rejected/unpaid = red) — moved to MUI Chip colors, not changed.
const BOOKING_STATUS_COLOR = {
  PAID: "success",
  PARTIAL: "warning",
  PENDING: "warning",
  BOOKED: "primary",
  OVERDUE: "error",
  FAILED: "error",
  REJECTED: "error",
  UNPAID: "error",
};

function bookingStatusColor(status) {
  return BOOKING_STATUS_COLOR[(status || "").toUpperCase()] || "default";
}

// Mirrors the original statusPillClass exactly: cancelled reads the same
// as not-yet-started (both "nothing to act on"), anything else in-between
// (in progress, etc.) reads as the amber "partial" tone.
function activityStatusColor(status) {
  if (status === "COMPLETED") return "success";
  if (status === "CANCELLED" || status === "NOT_STARTED") return "primary";
  return "warning";
}

function CoverageChip({ coverage }) {
  if (!coverage || coverage.status !== "ok") return null;
  const { has_shortage, activities_covered, upcoming_activities_total } = coverage.data;
  if (!has_shortage) {
    return (
      <Chip size="small" color="success" variant="outlined" icon={<CheckCircleOutlinedIcon />} label="Funded" />
    );
  }
  return (
    <Chip
      size="small"
      color={activities_covered === 0 ? "error" : "warning"}
      variant="outlined"
      icon={<WarningAmberOutlinedIcon />}
      label={`${activities_covered}/${upcoming_activities_total} covered`}
    />
  );
}

export default function FarmerRow({ clusterId, farmer, coverage, focusToken }) {
  const posthog = usePostHog();
  const rowRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [activities, setActivities] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function loadDetail() {
    setLoading(true);
    setError(null);
    try {
      const [payments, bookedActivities] = await Promise.all([
        api.getFarmerPayments(clusterId, farmer.farmer_id),
        api.getFarmerActivities(clusterId, farmer.farmer_id),
      ]);
      setData(payments);
      setActivities(bookedActivities);
    } catch (e) {
      trackException(posthog, e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(_, isExpanded) {
    setOpen(isExpanded);
    if (!isExpanded) return;
    track(posthog, "farmer_row_expanded", { cluster_id: clusterId, farmer_id: farmer.farmer_id });
    if (!data) loadDetail(); // already fetched once, don't refetch on every re-open
  }

  // Lets the Payment coverage summary "jump to" this farmer — expand and
  // scroll it into view. token changes on every click (even re-clicking
  // the same farmer), so this fires each time, not just on first mention.
  useEffect(() => {
    if (focusToken == null) return;
    setOpen(true);
    if (!data) loadDetail();
    const frame = requestAnimationFrame(() => {
      rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken]);

  return (
    <Accordion
      ref={rowRef}
      expanded={open}
      onChange={handleChange}
      disableGutters
      square
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        "&:before": { display: "none" },
        overflow: "hidden",
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          px: 2,
          "& .MuiAccordionSummary-content": {
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
            minWidth: 0,
          },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
              {farmer.farmer_name}
            </Typography>
            <Stack direction="row" spacing={0.4} className="ph-no-capture" sx={{ alignItems: "center" }}>
              <PhoneOutlinedIcon sx={{ fontSize: 14, color: "text.disabled" }} />
              <Typography variant="caption" color="text.secondary">
                {farmer.phone_number || "no phone on file"}
              </Typography>
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ mt: 0.4 }}>
            <Stack direction="row" spacing={0.4} sx={{ alignItems: "center" }}>
              <LandscapeOutlinedIcon sx={{ fontSize: 14, color: "text.disabled" }} />
              <Typography variant="caption" color="text.secondary">
                {farmer.plot_count} {farmer.plot_count === 1 ? "plot" : "plots"}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.4} sx={{ alignItems: "center" }}>
              <EventOutlinedIcon sx={{ fontSize: 14, color: "text.disabled" }} />
              <Typography variant="caption" color="text.secondary">
                {farmer.activity_count} {farmer.activity_count === 1 ? "activity" : "activities"}
              </Typography>
            </Stack>
          </Stack>
        </Box>

        <CoverageChip coverage={coverage} />
      </AccordionSummary>

      <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
        <Divider sx={{ mb: 2 }} />

        {coverage?.status === "ok" && (
          <Alert
            icon={<AccountBalanceWalletOutlinedIcon fontSize="small" />}
            severity={
              coverage.data.has_shortage ? (coverage.data.activities_covered === 0 ? "error" : "warning") : "success"
            }
            sx={{ mb: 2, alignItems: "flex-start" }}
          >
            <Typography variant="body2">
              Vault balance <strong>{formatCurrency(coverage.data.vault_balance)}</strong> — covers{" "}
              {coverage.data.activities_covered}/{coverage.data.upcoming_activities_total} upcoming activities
              {coverage.data.has_shortage && " — hold off on the activities marked below"}
            </Typography>
            {coverage.data.has_shortage && (
              <Stack spacing={0.5} sx={{ mt: 1.25 }}>
                {coverage.data.activities.map((a) => (
                  <Stack
                    key={a.activity_id}
                    direction="row"
                    spacing={0.75}
                    sx={{ alignItems: "center" }}
                    title={
                      a.covered
                        ? "Vault balance covers this"
                        : "Vault balance runs out before this activity — consider not scheduling yet"
                    }
                  >
                    {a.covered ? (
                      <CheckCircleOutlinedIcon sx={{ fontSize: 16, color: "success.main" }} />
                    ) : (
                      <WarningAmberOutlinedIcon sx={{ fontSize: 16, color: "error.main" }} />
                    )}
                    <Typography variant="caption">
                      {a.activity_name} — {formatCurrency(a.cost)}{" "}
                      {a.date_time ? `(${a.date_time.slice(0, 10)})` : "(unscheduled)"}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </Alert>
        )}
        {coverage?.status === "no-booking" && (
          <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
            No active September booking — payment coverage check not applicable.
          </Typography>
        )}
        {coverage?.status === "error" && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Coverage check failed: {coverage.message}
          </Alert>
        )}
        {coverage === undefined && (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
            <CircularProgress size={14} />
            <Typography variant="body2" color="text.secondary">
              Checking payment coverage…
            </Typography>
          </Stack>
        )}

        {loading && (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
            <CircularProgress size={14} />
            <Typography variant="body2" color="text.secondary">
              Loading payment activity…
            </Typography>
          </Stack>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {data && !data.booking && (
          <Typography variant="body2" color="text.disabled">
            No matching booking found for this cluster&apos;s season.
          </Typography>
        )}

        {data?.booking && (
          <>
            <Stack direction="row" spacing={4} sx={{ mb: 2, flexWrap: "wrap", alignItems: "center" }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  Gross
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {formatCurrency(data.booking.gross_amount)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  Advance
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {formatCurrency(data.booking.advance_paid)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  Balance
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {formatCurrency(data.booking.balance)}
                </Typography>
              </Box>
              <Chip size="small" label={data.booking.status} color={bookingStatusColor(data.booking.status)} />
            </Stack>

            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1 }}>
              <PaymentsOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Payments
              </Typography>
            </Stack>
            {data.payments.length === 0 ? (
              <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
                No individual payments recorded yet.
              </Typography>
            ) : (
              <Table size="small" sx={{ mb: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell width={36} />
                    <TableCell>Amount</TableCell>
                    <TableCell>Mode</TableCell>
                    <TableCell>Paid on</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.payments.map((p) => (
                    <TableRow key={p.id} hover>
                      <TableCell>
                        {p.paid_status ? (
                          <CheckCircleOutlinedIcon fontSize="small" color="success" titleAccess="Confirmed" />
                        ) : (
                          <HourglassEmptyOutlinedIcon fontSize="small" color="disabled" titleAccess="Unconfirmed" />
                        )}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{formatCurrency(p.amount)}</TableCell>
                      <TableCell sx={{ color: "text.secondary" }}>{p.mode}</TableCell>
                      <TableCell sx={{ color: "text.secondary" }}>
                        {p.paid_at ? p.paid_at.slice(0, 10) : "date pending"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}

        {activities?.length > 0 && (
          <>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1 }}>
              <TaskAltOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Booked activities ({activities.length})
              </Typography>
            </Stack>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Activity</TableCell>
                  <TableCell>Plot</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activities.map((a) => (
                  <TableRow key={a.activity_id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{a.activity_name}</TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>{a.plot_id || "—"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={a.status}
                        color={activityStatusColor(a.status)}
                        variant={a.status === "COMPLETED" ? "filled" : "outlined"}
                      />
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>{a.date || "no date yet"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
        {activities?.length === 0 && (
          <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
            No booked activities found for this cluster&apos;s season.
          </Typography>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
