// src/components/mukkadams/MukkadamBankDetailsDrawer.jsx
//
// Right-side slide-over showing a single mukkadam's bank account(s). Only
// ever opened for a row with has_bank_account === true, so bank_accounts is
// guaranteed non-empty when `mukkadam` is set — no empty state needed, just
// a defensive guard on `mukkadam` itself since MUI keeps Drawer children
// mounted through the close transition.
import { useState } from "react";
import { usePostHog } from "@posthog/react";
import {
  Box,
  Card,
  CardContent,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { track, trackGroup } from "../../analytics/track";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";

function maskAccountNumber(accountNumber, revealed) {
  if (!accountNumber) return "—";
  if (revealed) return accountNumber;
  const last4 = accountNumber.slice(-4);
  return `${"•".repeat(Math.max(accountNumber.length - 4, 4))}${last4}`;
}

function BankAccountCard({ account, revealed }) {
  return (
    // ph-no-capture: excludes this card's bank name/branch/IFSC/beneficiary/
    // account number from PostHog session replay and autocapture — never
    // let real bank details leave the app through analytics.
    <Card variant="outlined" className="ph-no-capture">
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
          <AccountBalanceOutlinedIcon fontSize="small" color="action" />
          <Typography variant="subtitle2">{account.bank_name || "Bank not specified"}</Typography>
        </Stack>
        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary">
            Branch: {account.branch || "—"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            IFSC: {account.ifsc_code || "—"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Beneficiary: {account.beneficiary_name || "—"}
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            A/C: {maskAccountNumber(account.account_number, revealed)}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function MukkadamBankDetailsDrawer({ mukkadam, open, onClose }) {
  const posthog = usePostHog();
  const [revealed, setRevealed] = useState(false);

  function handleToggleReveal() {
    if (!revealed) {
      trackGroup(posthog, "mukkadam", mukkadam?.mukkadam_id, { name: mukkadam?.mukkadam_name });
      track(posthog, "bank_details_revealed", {
        mukkadam_id: mukkadam?.mukkadam_id,
        account_count: mukkadam?.bank_accounts?.length ?? 0,
      });
    }
    setRevealed((value) => !value);
  }

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: 360, p: 2.5 }}>
        <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", mb: 0.5 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {mukkadam?.mukkadam_name || "Bank accounts"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {mukkadam?.bank_accounts?.length ?? 0} account
              {(mukkadam?.bank_accounts?.length ?? 0) === 1 ? "" : "s"} on file
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Stack direction="row" sx={{ justifyContent: "flex-end", mb: 1.5 }}>
          <Tooltip title={revealed ? "Mask account numbers" : "Reveal account numbers"}>
            <IconButton size="small" onClick={handleToggleReveal}>
              {revealed ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>

        <Stack spacing={1.5}>
          {mukkadam?.bank_accounts?.map((account) => (
            <BankAccountCard key={account.id} account={account} revealed={revealed} />
          ))}
        </Stack>
      </Box>
    </Drawer>
  );
}
