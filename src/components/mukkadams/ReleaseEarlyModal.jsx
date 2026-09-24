import { useState } from "react";
import { usePostHog } from "@posthog/react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  Paper,
  Radio,
  RadioGroup,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";
import { track, trackException, trackGroup } from "../../analytics/track";
import { opsApi } from "../../api/opsClient";
import { formatCurrency } from "../../utils/format";

const RELEASE_REASONS = [
  {
    value: "work_verified",
    label: "Work verified",
    description: "Up/Down team has verified that the work is completed.",
  },
  {
    value: "work_completed_before_onboarding",
    label: "Work completed before onboarding",
    description:
      "Work was completed earlier, but Mukkadam onboarding was delayed.",
  },
  {
    value: "late_activity_earning_request",
    label: "Late activity / earning request",
    description:
      "Activity did not start or end on schedule, and the Mukkadam is now requesting the earning.",
  },
  {
    value: "other",
    label: "Other reason",
    description: "Provide a specific reason for this early release.",
  },
];

export default function ReleaseEarlyModal({
  open,
  mukkadamId,
  ledgerId,
  amount,
  source,
  onClose,
  onReleased,
}) {
  const posthog = usePostHog();
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  // Two-step flow: pick a reason, then a distinct final-confirmation step
  // (with the amount front and center) before the mutation actually fires
  // — picking a reason and clicking one button was too easy to fat-finger
  // for something irreversible.
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function reset() {
    setSelectedReason("");
    setCustomReason("");
    setConfirming(false);
    setError(null);
  }

  function handleClose() {
    if (submitting) return;
    reset();
    onClose();
  }

  function handleReasonChange(event) {
    setSelectedReason(event.target.value);
    setError(null);

    if (event.target.value !== "other") {
      setCustomReason("");
    }
  }

  function resolvedReason() {
    return selectedReason === "other"
      ? customReason.trim()
      : RELEASE_REASONS.find((item) => item.value === selectedReason)?.label;
  }

  function handleContinue() {
    if (!selectedReason) {
      setError("Please select a reason.");
      return;
    }
    if (selectedReason === "other" && !customReason.trim()) {
      setError("Please provide a reason for the early release.");
      return;
    }
    setError(null);
    setConfirming(true);
  }

  async function handleConfirmRelease() {
    setSubmitting(true);
    setError(null);

    try {
      await opsApi.releaseLedgerEntryEarly({
        mukkadam_id: mukkadamId,
        ledger_id: ledgerId,
        reason: resolvedReason(),
      });

      trackGroup(posthog, "mukkadam", mukkadamId, {});
      track(posthog, "earning_released_early", {
        mukkadam_id: mukkadamId,
        ledger_id: ledgerId,
        amount,
        reason_code: selectedReason,
        source,
      });
      reset();
      onReleased?.();
    } catch (err) {
      trackException(posthog, err);
      track(posthog, "earning_release_failed", { mukkadam_id: mukkadamId, ledger_id: ledgerId, source });
      setError(
        err?.message || "Unable to release this earning. Please try again."
      );
      setConfirming(false); // back to the reason step, in case the reason itself needs adjusting
    } finally {
      setSubmitting(false);
    }
  }

  const canContinue =
    Boolean(selectedReason) &&
    (selectedReason !== "other" || Boolean(customReason.trim()));

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="release-early-dialog-title"
    >
      <DialogTitle
        id="release-early-dialog-title"
        sx={{
          fontWeight: 700,
          pb: 1,
        }}
      >
        {confirming ? "Final confirmation" : "Confirm Earning Release"}
      </DialogTitle>

      <DialogContent>
        {confirming ? (
          <>
            <Alert
              severity="error"
              sx={{
                mb: 2.5,
                alignItems: "flex-start",
                "& .MuiAlert-message": { width: "100%" },
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                You’re about to release {formatCurrency(amount)} early
              </Typography>
              <Typography variant="body2">
                This amount becomes withdrawable to the Mukkadam immediately, bypassing the normal maturity window.{" "}
                <strong>This action is irreversible.</strong> Double-check the amount before confirming.
              </Typography>
            </Alert>

            {error && (
              <Alert severity="error" sx={{ mb: 2.5 }}>
                {error}
              </Alert>
            )}

            <Typography variant="body2" color="text.secondary">
              Reason: <strong>{resolvedReason()}</strong>
            </Typography>
          </>
        ) : (
          <>
            <Alert
              severity="warning"
              sx={{
                mb: 3,
                alignItems: "flex-start",
                "& .MuiAlert-message": {
                  width: "100%",
                },
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Verify Before Releasing
              </Typography>

              <Typography variant="body2">
                This will immediately make the earning withdrawable and add it to
                the Mukkadam’s available earnings. Verify activity completion
                before proceeding. <strong>This action is irreversible.</strong>
              </Typography>
            </Alert>

            {error && (
              <Alert
                severity="error"
                sx={{
                  mb: 2.5,
                  "& .MuiAlert-message": {
                    width: "100%",
                  },
                }}
              >
                {error}
              </Alert>
            )}

            <FormControl
              component="fieldset"
              fullWidth
              error={Boolean(error && !selectedReason)}
            >
              <Typography
                component="legend"
                variant="subtitle2"
                fontWeight={600}
                sx={{ mb: 1.5 }}
              >
                Select release reason
              </Typography>

              <RadioGroup
                value={selectedReason}
                onChange={handleReasonChange}
              >
                {RELEASE_REASONS.map((reason) => {
                  const selected = selectedReason === reason.value;

                  return (
                    <Paper
                      key={reason.value}
                      variant="outlined"
                      onClick={() =>
                        !submitting &&
                        handleReasonChange({
                          target: { value: reason.value },
                        })
                      }
                      sx={{
                        mb: 1,
                        px: 1.5,
                        py: 1.25,
                        cursor: submitting ? "default" : "pointer",
                        borderColor: selected
                          ? "primary.main"
                          : "divider",
                        backgroundColor: selected
                          ? "action.selected"
                          : "background.paper",
                        transition: "all 0.15s ease",
                        "&:hover": {
                          borderColor: submitting
                            ? "divider"
                            : "primary.main",
                        },
                      }}
                    >
                      <FormControlLabel
                        value={reason.value}
                        disabled={submitting}
                        control={<Radio size="small" />}
                        label={
                          <div>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                            >
                              {reason.label}
                            </Typography>

                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {reason.description}
                            </Typography>
                          </div>
                        }
                        sx={{
                          width: "100%",
                          m: 0,
                          alignItems: "flex-start",
                          "& .MuiRadio-root": {
                            mt: -0.25,
                            mr: 1,
                          },
                        }}
                      />
                    </Paper>
                  );
                })}
              </RadioGroup>

              {error && !selectedReason && (
                <FormHelperText>
                  Please select a release reason.
                </FormHelperText>
              )}
            </FormControl>

            {selectedReason === "other" && (
              <TextField
                autoFocus
                fullWidth
                multiline
                minRows={3}
                maxRows={6}
                label="Reason"
                placeholder="Enter the reason for early release"
                value={customReason}
                onChange={(e) => {
                  setCustomReason(e.target.value);
                  setError(null);
                }}
                disabled={submitting}
                required
                error={Boolean(
                  error && selectedReason === "other" && !customReason.trim()
                )}
                helperText="This reason will be recorded in the audit trail."
                sx={{ mt: 2 }}
              />
            )}
          </>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: 2.5,
          pt: 1,
          gap: 1,
        }}
      >
        {confirming ? (
          <>
            <Button
              onClick={() => setConfirming(false)}
              disabled={submitting}
              variant="outlined"
              color="inherit"
            >
              Go back
            </Button>

            <Button
              onClick={handleConfirmRelease}
              variant="contained"
              color="error"
              disabled={submitting}
              sx={{
                minWidth: 180,
                fontWeight: 600,
                boxShadow: "none",
                "&:hover": {
                  boxShadow: "none",
                },
              }}
            >
              {submitting ? "Releasing…" : `Yes, release ${formatCurrency(amount)}`}
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={handleClose}
              disabled={submitting}
              variant="outlined"
              color="inherit"
            >
              Cancel
            </Button>

            <Button
              onClick={handleContinue}
              variant="contained"
              color="error"
              disabled={!canContinue}
              sx={{
                minWidth: 140,
                fontWeight: 600,
                boxShadow: "none",
                "&:hover": {
                  boxShadow: "none",
                },
              }}
            >
              Continue
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
