// src/components/ClusterVault.jsx
//
// Farmer vault balances for the cluster, so a manager can tell at a
// glance whether farmers have enough prepaid balance left to cover
// their next activity before allocating one. Meant to sit side by side
// with MukkadamCard — "money in from farmers" next to "money out to
// the mukkadam."
//
// Per-farmer rows mirror MukkadamPayoutRow's design language one-for-one
// (chevron toggle button, identity avatar, labeled stat, MUI Collapse,
// a capped/scrolling sticky-header table, matching empty state) so the
// two cards read as one polished, consistent system rather than a plain
// card next to a richly-styled one — just recolored (info blue here vs.
// the payout card's success green) and re-fielded for vault transactions
// (credit/debit + activity) instead of completed allocations.

import { useState } from "react";
import { usePostHog } from "@posthog/react";
import {
  Box,
  Chip,
  Collapse,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import { formatCurrency } from "../utils/format";
import { track } from "../analytics/track";

const SCROLL_SX = {
  maxHeight: 280,
  overflowY: "auto",
  "&::-webkit-scrollbar": { width: 5 },
  "&::-webkit-scrollbar-track": { background: "transparent" },
  "&::-webkit-scrollbar-thumb": { background: (t) => t.palette.divider, borderRadius: 10 },
};

const HEAD_CELL_SX = {
  fontWeight: 700,
  fontSize: 10.5,
  letterSpacing: 0.35,
  textTransform: "uppercase",
  color: "text.secondary",
  bgcolor: "background.paper",
  whiteSpace: "nowrap",
  py: 1,
};

function TransactionType({ type }) {
  const isCredit = type === "CREDIT";
  const Icon = isCredit ? ArrowUpwardRoundedIcon : ArrowDownwardRoundedIcon;
  return (
    <Stack direction="row" spacing={0.4} sx={{ alignItems: "center" }}>
      <Icon sx={{ fontSize: 14, color: isCredit ? "success.main" : "error.main" }} />
      <Typography variant="caption" sx={{ fontWeight: 600, color: isCredit ? "success.main" : "error.main" }}>
        {isCredit ? "Credit" : "Debit"}
      </Typography>
    </Stack>
  );
}

function TransactionsTable({ transactions }) {
  return (
    <TableContainer sx={{ ...SCROLL_SX, border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={HEAD_CELL_SX}>Description</TableCell>
            <TableCell sx={HEAD_CELL_SX}>Plot</TableCell>
            <TableCell sx={HEAD_CELL_SX}>Type</TableCell>
            <TableCell sx={HEAD_CELL_SX}>Date</TableCell>
            <TableCell sx={{ ...HEAD_CELL_SX, textAlign: "right" }}>Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((t) => {
            const isCredit = t.type === "CREDIT";
            return (
              <TableRow key={t.id} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
                <TableCell sx={{ py: 1.15 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }} noWrap>
                    {t.activity_name || "—"}
                  </Typography>
                  {(t.variety || t.acre) && (
                    <Typography variant="caption" color="text.secondary">
                      {[t.variety, t.acre ? `${t.acre} ac` : null].filter(Boolean).join(" · ")}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 400, color: "text.primary" }} noWrap>
                    {t.plot_id || "—"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <TransactionType type={t.type} />
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500 }}>
                    {t.created_at?.slice(0, 10) || "—"}
                  </Typography>
                </TableCell>
                <TableCell sx={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: isCredit ? "success.main" : "error.main" }}>
                    {isCredit ? "+" : "−"}
                    {formatCurrency(t.amount)}
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function EmptyTransactions() {
  return (
    <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, px: 2, py: 2.5, textAlign: "center", bgcolor: "background.default" }}>
      <ReceiptLongRoundedIcon sx={{ fontSize: 26, color: "text.disabled", mb: 0.5 }} />
      <Typography variant="body2" sx={{ fontWeight: 600, color: "text.secondary" }}>
        No transactions yet
      </Typography>
      <Typography variant="caption" color="text.disabled">
        Nothing has been credited or debited for this farmer yet.
      </Typography>
    </Box>
  );
}

function VaultFarmerRow({ farmer: f, open, onToggle }) {
  const transactionCount = f.transactions?.length ?? 0;
  const isHealthy = f.balance > 0 && !f.is_overdue;

  return (
    <Box
      className="vault-farmer"
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 2,
        transition: "background-color 160ms ease",
        ...(open && { bgcolor: "action.hover" }),
      }}
    >
      <Box
        sx={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          bgcolor: open ? "info.main" : "transparent",
          transition: "background-color 160ms ease",
        }}
      />

      <button type="button" className="vault-farmer__toggle" onClick={onToggle} aria-expanded={open} style={{ width: "100%" }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0, flex: 1, textAlign: "left" }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              bgcolor: open ? "info.main" : "action.hover",
              color: open ? "info.contrastText" : "text.secondary",
              flexShrink: 0,
              transition: "background-color 160ms ease, color 160ms ease",
            }}
          >
            <ExpandMoreRoundedIcon
              sx={{ fontSize: 19, transition: "transform 180ms ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </Box>

          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              bgcolor: (t) => alpha(t.palette.info.main, 0.12),
              color: "info.main",
              border: "1px solid",
              borderColor: "info.light",
            }}
          >
            <PersonRoundedIcon sx={{ fontSize: 17 }} />
          </Box>

          <Stack spacing={0.15} sx={{ minWidth: 0 }}>
            <Typography component="span" variant="body2" noWrap sx={{ fontWeight: 700, color: "text.primary" }}>
              {f.farmer_name}
            </Typography>
            <Typography component="span" variant="caption" sx={{ color: "text.secondary", lineHeight: 1.2 }}>
              {transactionCount} transaction{transactionCount === 1 ? "" : "s"}
            </Typography>
          </Stack>

          {f.is_overdue && (
            <Chip
              size="small"
              icon={<WarningAmberRoundedIcon sx={{ fontSize: "14px !important" }} />}
              label="Overdue"
              color="error"
              variant="outlined"
              sx={{ height: 20, fontSize: 10, fontWeight: 650, flexShrink: 0, display: { xs: "none", sm: "inline-flex" } }}
            />
          )}
        </Stack>

        <Stack direction="row" spacing={0.8} sx={{ alignItems: "center", flexShrink: 0, pl: 1 }}>
          <Box
            sx={{
              display: { xs: "none", md: "grid" },
              width: 28,
              height: 28,
              borderRadius: 1.5,
              placeItems: "center",
              bgcolor: (t) => alpha(t.palette[isHealthy ? "success" : "error"].main, 0.12),
              color: isHealthy ? "success.main" : "error.main",
            }}
          >
            <SavingsRoundedIcon sx={{ fontSize: 16 }} />
          </Box>
          <Stack spacing={0} sx={{ alignItems: "flex-end" }}>
            <Typography
              component="span"
              variant="caption"
              sx={{ color: "text.disabled", fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}
            >
              Balance
            </Typography>
            <Typography
              component="span"
              variant="body2"
              sx={{ fontWeight: 800, color: isHealthy ? "success.main" : "error.main", lineHeight: 1.2 }}
            >
              {formatCurrency(f.balance)}
            </Typography>
          </Stack>
        </Stack>
      </button>

      <Collapse in={open} timeout={180} unmountOnExit>
        <Box sx={{ px: { xs: 1, sm: 1.5 }, pb: 1.5, pt: 0.25 }}>
          <Divider sx={{ mb: 1.25, opacity: 0.7 }} />

          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Transaction history
              </Typography>
              <Chip size="small" label={transactionCount} sx={{ height: 17, minWidth: 22, fontSize: 9.5, fontWeight: 700, "& .MuiChip-label": { px: 0.65 } }} />
            </Stack>
            {transactionCount > 0 && (
              <Typography variant="caption" color="text.disabled">
                Scroll to view more
              </Typography>
            )}
          </Stack>

          {transactionCount === 0 ? <EmptyTransactions /> : <TransactionsTable transactions={f.transactions} />}
        </Box>
      </Collapse>
    </Box>
  );
}

// vault/error come from useClusterVault, called once by ClusterDetailPage
// (and shared with ClusterFinancialSummary's revenue figure) rather than
// fetched again here.
export default function ClusterVault({ clusterId, deployed, vault, error }) {
  const posthog = usePostHog();
  const [openFarmerId, setOpenFarmerId] = useState(null);

  function handleToggleFarmer(farmerId) {
    if (openFarmerId !== farmerId) {
      track(posthog, "vault_farmer_expanded", { cluster_id: clusterId, farmer_id: farmerId });
    }
    setOpenFarmerId(openFarmerId === farmerId ? null : farmerId);
  }

  if (error) return <p className="error-text">{error}</p>;

  return (
    <div className="info-card">
      <div className="info-card__title-row">
        <div className="info-card__title">Farmer vault</div>
        {vault && (
          <div style={{ textAlign: "right" }}>
            <div className="stat-box__value" style={{ fontSize: 16 }}>
              {formatCurrency(vault.total_balance)}
            </div>
            <div className="stat-box__label">Total balance</div>
          </div>
        )}
      </div>

      {!vault && <p className="muted">Loading…</p>}

      {deployed && vault && vault.total_balance <= 0 && (
        <p className="muted" style={{ color: "var(--color-fail)", marginBottom: 8 }}>
          ⚠ No farmer payments received yet.
        </p>
      )}

      {vault?.overdue_count > 0 && (
        <p className="muted" style={{ color: "var(--color-fail)", marginBottom: 8 }}>
          {vault.overdue_count} {vault.overdue_count === 1 ? "farmer is" : "farmers are"} overdue.
        </p>
      )}

      {vault?.farmers.map((f) => (
        <VaultFarmerRow
          key={f.farmer_id}
          farmer={f}
          open={openFarmerId === f.farmer_id}
          onToggle={() => handleToggleFarmer(f.farmer_id)}
        />
      ))}
    </div>
  );
}
