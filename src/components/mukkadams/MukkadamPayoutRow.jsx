import { useState } from "react";
import {
  Box,
  Chip,
  Collapse,
  Divider,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import EngineeringRoundedIcon from "@mui/icons-material/EngineeringRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import { formatCurrency } from "../../utils/format";

const SCROLL_SX = {
  maxHeight: 300,
  overflowY: "auto",
  "&::-webkit-scrollbar": {
    width: 5,
  },
  "&::-webkit-scrollbar-track": {
    background: "transparent",
  },
  "&::-webkit-scrollbar-thumb": {
    background: (theme) => theme.palette.divider,
    borderRadius: 10,
  },
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

function AllocationStatus({ allocation }) {
  const allocated = Number(allocation.allocated_area || 0);
  const completed = Number(allocation.actual?.area || 0);

  if (!allocated) {
    return (
      <Typography variant="caption" color="text.disabled">
        —
      </Typography>
    );
  }

  const percentage = Math.min(
    100,
    Math.round((completed / allocated) * 100)
  );

  return (
    <Stack spacing={0.45} sx={{ minWidth: 105 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Typography
          variant="caption"
          sx={{ fontWeight: 600, color: "text.primary" }}
        >
          {completed} / {allocated} ac
        </Typography>

        <Typography
          variant="caption"
          sx={{
            fontSize: 10,
            fontWeight: 700,
            color:
              percentage >= 100
                ? "success.main"
                : percentage > 0
                  ? "warning.main"
                  : "text.disabled",
          }}
        >
          {percentage}%
        </Typography>
      </Stack>

      <LinearProgress
        variant="determinate"
        value={percentage}
        sx={{
          height: 4,
          borderRadius: 10,
          bgcolor: "action.hover",
          "& .MuiLinearProgress-bar": {
            borderRadius: 10,
            bgcolor:
              percentage >= 100 ? "success.main" : "primary.main",
          },
        }}
      />
    </Stack>
  );
}

function AllocationsTable({ allocations }) {
  return (
    <TableContainer
      sx={{
        ...SCROLL_SX,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
    >
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={HEAD_CELL_SX}>Activity</TableCell>
            <TableCell sx={HEAD_CELL_SX}>Area</TableCell>
            <TableCell sx={HEAD_CELL_SX}>Date</TableCell>
            <TableCell
              sx={{
                ...HEAD_CELL_SX,
                textAlign: "right",
              }}
            >
              Payout
            </TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {allocations.map((a) => {
            const actualAmount = a.actual?.amount;

            return (
              <TableRow
                key={a.allocation_id}
                hover
                sx={{
                  "&:last-child td": {
                    borderBottom: 0,
                  },
                  transition: "background-color 120ms ease",
                }}
              >
                {/* Activity / Farmer / Plot */}
                <TableCell sx={{ py: 1.15 }}>
                  <Stack spacing={0.35}>
                    <Stack
                      direction="row"
                      spacing={0.6}
                      alignItems="center"
                      minWidth={0}
                    >
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{
                          fontWeight: 650,
                          color: "text.primary",
                          maxWidth: 220,
                        }}
                      >
                        {a.activity_name}
                      </Typography>

                      {a.is_carry_forward && (
                        <Tooltip
                          title={
                            a.carry_forward_from_allocation_id
                              ? `Continues allocation #${a.carry_forward_from_allocation_id} — leftover area from a partial completion`
                              : "Continues an earlier partially-completed allocation"
                          }
                          arrow
                        >
                          <CallSplitIcon
                            sx={{
                              fontSize: 15,
                              color: "warning.main",
                              flexShrink: 0,
                            }}
                          />
                        </Tooltip>
                      )}
                    </Stack>

                    <Stack
                      direction="row"
                      spacing={0.75}
                      alignItems="center"
                      flexWrap="wrap"
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                          fontWeight: 500,
                        }}
                      >
                        {a.farmer_name || "Unknown farmer"}
                      </Typography>

                      <Box
                        component="span"
                        sx={{
                          width: 3,
                          height: 3,
                          borderRadius: "50%",
                          bgcolor: "text.disabled",
                        }}
                      />

                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary" }}
                      >
                        Plot {a.plot_code || "—"}
                      </Typography>

                      {a.plot_total_acres != null && (
                        <Chip
                          size="small"
                          label={`${a.plot_total_acres} ac`}
                          sx={{
                            height: 17,
                            fontSize: 9.5,
                            fontWeight: 600,
                            bgcolor: "action.hover",
                            "& .MuiChip-label": {
                              px: 0.7,
                            },
                          }}
                        />
                      )}
                    </Stack>
                  </Stack>
                </TableCell>

                {/* Area */}
                <TableCell>
                  <AllocationStatus allocation={a} />
                </TableCell>

                {/* Date */}
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontWeight: 500,
                    }}
                  >
                    {a.allocated_date || "—"}
                  </Typography>
                </TableCell>

                {/* Amount */}
                <TableCell sx={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 700,
                      color: "success.main",
                    }}
                  >
                    {formatCurrency(actualAmount)}
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

function EmptyAllocations() {
  return (
    <Box
      sx={{
        border: "1px dashed",
        borderColor: "divider",
        borderRadius: 2,
        px: 2,
        py: 2.5,
        textAlign: "center",
        bgcolor: "background.default",
      }}
    >
      <EngineeringRoundedIcon
        sx={{
          fontSize: 26,
          color: "text.disabled",
          mb: 0.5,
        }}
      />

      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          color: "text.secondary",
        }}
      >
        No completed allocations
      </Typography>

      <Typography
        variant="caption"
        color="text.disabled"
      >
        There are no completed allocations for this season.
      </Typography>
    </Box>
  );
}

export default function MukkadamPayoutRow({ group }) {
  const [open, setOpen] = useState(false);

  const allocationCount = group.total_allocations || 0;
  const allocations = group.allocations || [];

  return (
    <Box
      className="vault-farmer"
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 2,
        transition:
          "background-color 160ms ease, box-shadow 160ms ease",
        ...(open && {
          bgcolor: "action.hover",
        }),
      }}
    >
      {/* Accent line when expanded */}
      <Box
        sx={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          bgcolor: open ? "primary.main" : "transparent",
          transition: "background-color 160ms ease",
        }}
      />

      <button
        type="button"
        className="vault-farmer__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            minWidth: 0,
            flex: 1,
            textAlign: "left",
          }}
        >
          {/* Chevron */}
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              bgcolor: open ? "primary.main" : "action.hover",
              color: open ? "primary.contrastText" : "text.secondary",
              flexShrink: 0,
              transition:
                "background-color 160ms ease, color 160ms ease",
            }}
          >
            <ExpandMoreRoundedIcon
              sx={{
                fontSize: 19,
                transition: "transform 180ms ease",
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </Box>

          {/* Avatar / identity */}
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              bgcolor: "success.lighter",
              color: "success.main",
              border: "1px solid",
              borderColor: "success.light",
            }}
          >
            <EngineeringRoundedIcon sx={{ fontSize: 17 }} />
          </Box>

          {/* Name + allocation count */}
          <Stack spacing={0.15} minWidth={0}>
            <Typography
              component="span"
              variant="body2"
              noWrap
              sx={{
                fontWeight: 700,
                color: "text.primary",
              }}
            >
              {group.mukkadam_name || `#${group.mukkadam_id}`}
            </Typography>

            <Typography
              component="span"
              variant="caption"
              sx={{
                color: "text.secondary",
                lineHeight: 1.2,
              }}
            >
              {allocationCount} completed{" "}
              {allocationCount === 1 ? "allocation" : "allocations"}
            </Typography>
          </Stack>

          <Chip
            size="small"
            label={`${allocationCount} alloc${allocationCount === 1 ? "" : "s"}`}
            sx={{
              display: { xs: "none", sm: "inline-flex" },
              height: 20,
              fontSize: 10,
              fontWeight: 650,
              bgcolor: open ? "primary.50" : "action.hover",
              color: open ? "primary.main" : "text.secondary",
              border: "1px solid",
              borderColor: open ? "primary.100" : "divider",
            }}
          />
        </Stack>

        {/* Payout */}
        <Stack
          direction="row"
          spacing={0.8}
          alignItems="center"
          sx={{
            flexShrink: 0,
            pl: 1,
          }}
        >
          <Box
            sx={{
              display: { xs: "none", md: "grid" },
              width: 28,
              height: 28,
              borderRadius: 1.5,
              placeItems: "center",
              bgcolor: "success.50",
              color: "success.main",
            }}
          >
            <PaymentsRoundedIcon sx={{ fontSize: 16 }} />
          </Box>

          <Stack spacing={0} alignItems="flex-end">
            <Typography
              component="span"
              variant="caption"
              sx={{
                color: "text.disabled",
                fontSize: 9.5,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Total payout
            </Typography>

            <Typography
              component="span"
              variant="body2"
              sx={{
                fontWeight: 800,
                color: "success.main",
                lineHeight: 1.2,
              }}
            >
              {formatCurrency(group.total_payout)}
            </Typography>
          </Stack>
        </Stack>
      </button>

      {/* Expandable content */}
      <Collapse in={open} timeout={180} unmountOnExit>
        <Box
          sx={{
            px: { xs: 1, sm: 1.5 },
            pb: 1.5,
            pt: 0.25,
          }}
        >
          <Divider sx={{ mb: 1.25, opacity: 0.7 }} />

          {/* Section summary */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1 }}
          >
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: "text.secondary",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Allocation history
              </Typography>

              <Chip
                size="small"
                label={allocationCount}
                sx={{
                  height: 17,
                  minWidth: 22,
                  fontSize: 9.5,
                  fontWeight: 700,
                  "& .MuiChip-label": {
                    px: 0.65,
                  },
                }}
              />
            </Stack>

            <Typography
              variant="caption"
              color="text.disabled"
            >
              Scroll to view more
            </Typography>
          </Stack>

          {allocations.length === 0 ? (
            <EmptyAllocations />
          ) : (
            <AllocationsTable allocations={allocations} />
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
