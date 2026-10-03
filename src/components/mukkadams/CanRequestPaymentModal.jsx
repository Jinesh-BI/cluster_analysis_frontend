// src/components/mukkadams/CanRequestPaymentModal.jsx
//
// Admin/Regional Manager only — flips Mukkadam.can_request_payment via the
// integration API. am_id is never typed by hand: it's the logged-in user's
// own username (useAuth().user.username), appended server-side to the
// mukkadam's am_id history alongside the reason. Reason is compulsory —
// the backend only appends it to an audit trail when non-blank, so an
// empty reason would silently lose the "why" for this change.
import { useState } from "react";
import { usePostHog } from "@posthog/react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from "@mui/material";
import { mukkadamIntegrationApi } from "../../api/mukkadamIntegrationClient";
import { useAuth } from "../../context/AuthContext";
import { track, trackException, trackGroup } from "../../analytics/track";

export default function CanRequestPaymentModal({ open, mukkadam, onClose, onUpdated }) {
  const posthog = usePostHog();
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const targetValue = !mukkadam?.can_request_payment;
  const name = mukkadam?.mukkadam_name || "This mukkadam";

  function reset() {
    setReason("");
    setError(null);
  }

  function handleClose() {
    if (submitting) return;
    reset();
    onClose();
  }

  async function handleConfirm() {
    if (!reason.trim()) {
      setError("Please enter a reason — it's required for this change.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await mukkadamIntegrationApi.updateCanRequestPayment(mukkadam.mukkadam_id, {
        canRequestPayment: targetValue,
        reason: reason.trim(),
        amId: user?.username,
      });
      trackGroup(posthog, "mukkadam", mukkadam.mukkadam_id, {});
      track(posthog, "mukkadam_can_request_payment_changed", {
        mukkadam_id: mukkadam.mukkadam_id,
        can_request_payment: targetValue,
      });
      reset();
      onUpdated?.(result);
    } catch (err) {
      trackException(posthog, err);
      track(posthog, "mukkadam_can_request_payment_change_failed", { mukkadam_id: mukkadam.mukkadam_id });
      setError(err?.message || "Could not update this setting. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth aria-labelledby="can-request-payment-title">
      <DialogTitle id="can-request-payment-title" sx={{ fontWeight: 700, pb: 1 }}>
        {targetValue ? "Allow payment requests" : "Block payment requests"}
      </DialogTitle>

      <DialogContent>
        <Alert severity={targetValue ? "success" : "warning"} sx={{ mb: 2.5 }}>
          <Typography variant="body2">
            {targetValue
              ? `${name} will be able to request and withdraw payments again.`
              : `${name} will not be able to request or withdraw payments.`}
          </Typography>
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mb: 2.5 }}>
            {error}
          </Alert>
        )}

        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={3}
          maxRows={6}
          label="Reason"
          placeholder={targetValue ? "Why is this mukkadam being re-enabled?" : "Why is this mukkadam being blocked?"}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError(null);
          }}
          disabled={submitting}
          required
          error={Boolean(error)}
          helperText={`Recorded in ${name}'s permission history as ${user?.username || "you"}.`}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
        <Button onClick={handleClose} disabled={submitting} variant="outlined" color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={targetValue ? "success" : "error"}
          disabled={submitting || !reason.trim()}
          sx={{ minWidth: 160, fontWeight: 600, boxShadow: "none", "&:hover": { boxShadow: "none" } }}
        >
          {submitting ? "Saving…" : targetValue ? "Allow payment requests" : "Block payment requests"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
