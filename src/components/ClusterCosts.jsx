// src/components/ClusterCosts.jsx

import { useEffect, useMemo, useState } from "react";
import { usePostHog } from "@posthog/react";
import {
  Box,
  Chip,
  Collapse,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import AgricultureRoundedIcon from "@mui/icons-material/AgricultureRounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import HomeWorkRoundedIcon from "@mui/icons-material/HomeWorkRounded";
import ShoppingBasketRoundedIcon from "@mui/icons-material/ShoppingBasketRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";

import { api } from "../api/client";
import { formatCurrency } from "../utils/format";
import { track, trackException } from "../analytics/track";

const PRESET_CATEGORIES = ["Shed", "Essentials", "Travel", "Labor"];

const CATEGORY_CONFIG = {
  Shed: {
    icon: HomeWorkRoundedIcon,
    color: "warning",
  },
  Essentials: {
    icon: ShoppingBasketRoundedIcon,
    color: "info",
  },
  Travel: {
    icon: LocalShippingRoundedIcon,
    color: "secondary",
  },
  Labor: {
    icon: AgricultureRoundedIcon,
    color: "success",
  },
};

function getCategoryConfig(category) {
  return (
    CATEGORY_CONFIG[category] || {
      icon: MoreHorizRoundedIcon,
      color: "primary",
    }
  );
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

/* ------------------------------------------------------------------
   Single inline expense row
------------------------------------------------------------------- */

function CostRow({ cost }) {
  const config = getCategoryConfig(cost.category);
  const Icon = config.icon;
  const approved = Boolean(cost.request_approved);

  return (
    <Box
      sx={{
        px: 1,
        py: 0.8,
        borderBottom: "1px solid",
        borderColor: "divider",
        transition: "background-color 120ms ease",
        "&:hover": {
          bgcolor: "action.hover",
        },
        "&:last-child": {
          borderBottom: 0,
        },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          minWidth: 0,
          width: "100%",
        }}
      >
        {/* ----------------------------------------------------------
            Category
        ----------------------------------------------------------- */}
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.65}
          sx={{
            minWidth: 115,
            width: 115,
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: 1.25,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              bgcolor: `${config.color}.50`,
              color: `${config.color}.main`,
              border: "1px solid",
              borderColor: `${config.color}.100`,
            }}
          >
            <Icon sx={{ fontSize: 16 }} />
          </Box>

          <Typography
            variant="body2"
            noWrap
            sx={{
              fontWeight: 700,
              color: "text.primary",
            }}
          >
            {cost.category}
          </Typography>
        </Stack>

        {/* ----------------------------------------------------------
            Note
        ----------------------------------------------------------- */}
        <Typography
          variant="caption"
          noWrap
          sx={{
            flex: 1,
            minWidth: 0,
            color: cost.note
              ? "text.secondary"
              : "text.disabled",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={cost.note || ""}
        >
          {cost.note || "No note"}
        </Typography>

        {/* ----------------------------------------------------------
            Created by + date
        ----------------------------------------------------------- */}
        <Typography
          variant="caption"
          noWrap
          sx={{
            minWidth: 125,
            maxWidth: 150,
            color: "text.disabled",
            textAlign: "right",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={cost.created_by_name || "Unknown"}
        >
          {cost.created_by_name || "Unknown"} ·{" "}
          {formatDate(cost.created_at)}
        </Typography>

        {/* ----------------------------------------------------------
            Status
        ----------------------------------------------------------- */}
        <Chip
          size="small"
          icon={
            approved ? (
              <CheckCircleRoundedIcon />
            ) : (
              <ScheduleRoundedIcon />
            )
          }
          label={approved ? "Approved" : "Pending"}
          sx={{
            height: 20,
            minWidth: 78,
            flexShrink: 0,
            fontSize: 9.5,
            fontWeight: 700,
            color: approved
              ? "success.dark"
              : "warning.dark",
            bgcolor: approved
              ? "success.50"
              : "warning.50",
            border: "1px solid",
            borderColor: approved
              ? "success.100"
              : "warning.100",
            "& .MuiChip-icon": {
              fontSize: 12,
              color: "inherit",
              ml: 0.5,
            },
            "& .MuiChip-label": {
              px: 0.7,
            },
          }}
        />

        {/* ----------------------------------------------------------
            Amount
        ----------------------------------------------------------- */}
        <Typography
          variant="body2"
          sx={{
            minWidth: 90,
            textAlign: "right",
            fontWeight: 800,
            color: "text.primary",
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0,
          }}
        >
          {formatCurrency(cost.amount_spent)}
        </Typography>
      </Stack>
    </Box>
  );
}

/* ------------------------------------------------------------------
   Summary item
------------------------------------------------------------------- */

function SummaryItem({ label, value, color = "text.primary" }) {
  return (
    <Stack
      direction="row"
      spacing={0.45}
      alignItems="baseline"
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 800,
          color,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </Typography>

      <Typography
        variant="caption"
        color="text.disabled"
      >
        {label}
      </Typography>
    </Stack>
  );
}

/* ------------------------------------------------------------------
   Cost form
------------------------------------------------------------------- */

function CostForm({
  category,
  setCategory,
  customCategory,
  setCustomCategory,
  note,
  setNote,
  amount,
  setAmount,
  saving,
  formError,
  onSubmit,
  onCancel,
}) {
  return (
    <Box
      component="form"
      onSubmit={onSubmit}
      sx={{
        mt: 1,
        p: 1.25,
        borderRadius: 2,
        bgcolor: "background.default",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack spacing={1}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
          >
            <ReceiptLongRoundedIcon
              sx={{
                fontSize: 18,
                color: "primary.main",
              }}
            />

            <Typography
              variant="body2"
              sx={{ fontWeight: 700 }}
            >
              Log cluster cost
            </Typography>
          </Stack>

          <Tooltip title="Close">
            <IconButton
              size="small"
              onClick={onCancel}
              disabled={saving}
            >
              <CloseRoundedIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        </Stack>

        <Divider />

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={0.75}
        >
          <Select
            size="small"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={saving}
            sx={{ minWidth: 145 }}
          >
            {PRESET_CATEGORIES.map((item) => {
              const ItemIcon = getCategoryConfig(item).icon;

              return (
                <MenuItem key={item} value={item}>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    alignItems="center"
                  >
                    <ItemIcon
                      sx={{
                        fontSize: 17,
                        color: `${getCategoryConfig(item).color}.main`,
                      }}
                    />
                    <span>{item}</span>
                  </Stack>
                </MenuItem>
              );
            })}

            <MenuItem value="Other">
              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
              >
                <MoreHorizRoundedIcon
                  sx={{ fontSize: 17 }}
                />
                <span>Other…</span>
              </Stack>
            </MenuItem>
          </Select>

          {category === "Other" && (
            <TextField
              size="small"
              placeholder="Category"
              value={customCategory}
              onChange={(e) =>
                setCustomCategory(e.target.value)
              }
              disabled={saving}
            />
          )}

          <TextField
            size="small"
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={saving}
            sx={{
              width: { sm: 140 },
            }}
            InputProps={{
              startAdornment: (
                <Typography
                  sx={{
                    mr: 0.5,
                    color: "text.secondary",
                    fontWeight: 700,
                  }}
                >
                  ₹
                </Typography>
              ),
            }}
          />

          <TextField
            size="small"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={saving}
            sx={{ flex: 1 }}
          />

          <button
            className="btn btn-primary"
            type="submit"
            disabled={saving}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              whiteSpace: "nowrap",
            }}
          >
            <SaveRoundedIcon sx={{ fontSize: 15 }} />
            {saving ? "Saving cost..." : "Save Cost"}
          </button>
        </Stack>

        {formError && (
          <Typography
            variant="caption"
            sx={{
              color: "error.main",
              fontWeight: 600,
            }}
          >
            {formError}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

/* ------------------------------------------------------------------
   Main component
------------------------------------------------------------------- */

export default function ClusterCosts({ clusterId }) {
  const posthog = usePostHog();

  const [costs, setCosts] = useState(null);
  const [totalSpent, setTotalSpent] = useState(0);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [category, setCategory] = useState(
    PRESET_CATEGORIES[0]
  );
  const [customCategory, setCustomCategory] = useState("");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  function load() {
    setError(null);

    api
      .getClusterCosts(clusterId)
      .then((res) => {
        setCosts(res.costs || []);
        setTotalSpent(Number(res.total_spent) || 0);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    setCosts(null);
    load();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterId]);

  const pendingCount = useMemo(
    () =>
      costs?.filter(
        (cost) => !cost.request_approved
      ).length || 0,
    [costs]
  );

  const approvedCount =
    (costs?.length || 0) - pendingCount;

  async function handleSubmit(e) {
    e.preventDefault();

    const finalCategory =
      category === "Other"
        ? customCategory.trim()
        : category;

    if (!finalCategory) {
      setFormError("Enter a category.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setFormError("Enter an amount greater than 0.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      await api.createClusterCost(clusterId, {
        category: finalCategory,
        note,
        amount_spent: Number(amount),
      });

      track(posthog, "cluster_cost_logged", {
        cluster_id: clusterId,
        category: finalCategory,
        amount: Number(amount),
        note_provided: Boolean(note.trim()),
      });

      setCategory(PRESET_CATEGORIES[0]);
      setCustomCategory("");
      setNote("");
      setAmount("");
      setShowForm(false);

      load();
    } catch (e) {
      trackException(posthog, e);

      track(posthog, "cluster_cost_log_failed", {
        cluster_id: clusterId,
      });

      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return <p className="error-text">{error}</p>;
  }

  return (
    <div className="info-card">
      {/* =========================================================
          HEADER
      ========================================================= */}
      <div className="info-card__title-row">
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          minWidth={0}
        >
          <ReceiptLongRoundedIcon
            sx={{
              fontSize: 19,
              color: "warning.main",
              flexShrink: 0,
            }}
          />

          <Stack spacing={0}>
            <div className="info-card__title">
              Cluster costs
            </div>

            <Typography
              variant="caption"
              color="text.disabled"
            >
              Operating expenses
            </Typography>
          </Stack>
        </Stack>

        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
        >
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="baseline"
          >
            <Typography
              sx={{
                fontSize: 16,
                fontWeight: 800,
                lineHeight: 1,
                color: "text.primary",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatCurrency(totalSpent)}
            </Typography>

            <Typography
              variant="caption"
              color="text.disabled"
            >
              spent
            </Typography>
          </Stack>

          <Tooltip title="Log a cost">
            <IconButton
              size="small"
              onClick={() => {
                setFormError(null);
                setShowForm((v) => !v);
              }}
              sx={{
                width: 30,
                height: 30,
                border: "1px solid",
                borderColor: showForm
                  ? "divider"
                  : "primary.200",
                color: showForm
                  ? "text.secondary"
                  : "primary.main",
                bgcolor: showForm
                  ? "action.hover"
                  : "primary.50",
              }}
            >
              {showForm ? (
                <CloseRoundedIcon sx={{ fontSize: 17 }} />
              ) : (
                <AddRoundedIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </Tooltip>
        </Stack>
      </div>

      {/* =========================================================
          INLINE SUMMARY
      ========================================================= */}
      {costs !== null && (
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            mt: 0.75,
            mb: 0.75,
          }}
        >
          <SummaryItem
            value={costs.length}
            label={costs.length === 1 ? "expense" : "expenses"}
          />

          <SummaryItem
            value={approvedCount}
            label="approved"
            color="success.main"
          />

          {pendingCount > 0 && (
            <SummaryItem
              value={pendingCount}
              label="pending"
              color="warning.main"
            />
          )}
        </Stack>
      )}

      {/* =========================================================
          FORM
      ========================================================= */}
      <Collapse
        in={showForm}
        timeout={160}
        unmountOnExit
      >
        <CostForm
          category={category}
          setCategory={setCategory}
          customCategory={customCategory}
          setCustomCategory={setCustomCategory}
          note={note}
          setNote={setNote}
          amount={amount}
          setAmount={setAmount}
          saving={saving}
          formError={formError}
          onSubmit={handleSubmit}
          onCancel={() => {
            if (!saving) {
              setShowForm(false);
              setFormError(null);
            }
          }}
        />
      </Collapse>

      {/* =========================================================
          LOADING
      ========================================================= */}
      {costs === null && (
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{
            display: "block",
            py: 1,
          }}
        >
          Loading expenses…
        </Typography>
      )}

      {/* =========================================================
          EMPTY
      ========================================================= */}
      {costs?.length === 0 && !showForm && (
        <Box
          sx={{
            py: 1.5,
            px: 1,
            textAlign: "center",
            border: "1px dashed",
            borderColor: "divider",
            borderRadius: 1.5,
            bgcolor: "background.default",
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
          >
            No cluster costs logged yet.
          </Typography>
        </Box>
      )}

      {/* =========================================================
          INLINE LEDGER
      ========================================================= */}
      {costs?.length > 0 && (
        <Box
          sx={{
            mt: 0.75,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1.5,
            overflow: "hidden",
            maxHeight: 310,
            overflowY: "auto",
            "&::-webkit-scrollbar": {
              width: 4,
            },
            "&::-webkit-scrollbar-thumb": {
              bgcolor: "divider",
              borderRadius: 4,
            },
          }}
        >
          {/* Table-like header */}
          <Box
            sx={{
              px: 1,
              py: 0.6,
              bgcolor: "background.default",
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
            >
              <Typography
                variant="caption"
                sx={{
                  width: 115,
                  flexShrink: 0,
                  fontSize: 9.5,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: "text.disabled",
                }}
              >
                Category
              </Typography>

              <Typography
                variant="caption"
                sx={{
                  flex: 1,
                  fontSize: 9.5,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: "text.disabled",
                }}
              >
                Description
              </Typography>

              <Typography
                variant="caption"
                sx={{
                  width: 150,
                  flexShrink: 0,
                  textAlign: "right",
                  fontSize: 9.5,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: "text.disabled",
                }}
              >
                Logged by / Date
              </Typography>

              <Box sx={{ width: 78, flexShrink: 0 }} />

              <Typography
                variant="caption"
                sx={{
                  width: 90,
                  flexShrink: 0,
                  textAlign: "right",
                  fontSize: 9.5,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: "text.disabled",
                }}
              >
                Amount
              </Typography>
            </Stack>
          </Box>

          {costs.map((cost) => (
            <CostRow
              key={cost.id}
              cost={cost}
            />
          ))}
        </Box>
      )}
    </div>
  );
}
