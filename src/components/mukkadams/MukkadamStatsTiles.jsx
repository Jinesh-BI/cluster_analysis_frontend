// src/components/mukkadams/MukkadamStatsTiles.jsx
//
// Dashboard header for the mukkadam deployment counts integration API.
// Interactive compact metadata display with MUI icons and semantic color accents.
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineOutlined from "@mui/icons-material/CheckCircleOutlineOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import SwapVertOutlinedIcon from "@mui/icons-material/SwapVertOutlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { mukkadamIntegrationApi } from "../../api/mukkadamIntegrationClient";

export default function MukkadamStatsTiles() {
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback((signal) => {
    setLoading(true);
    setError(null);
    mukkadamIntegrationApi
      .getMukkadamCounts(signal)
      .then((data) => setCounts(data))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (error) {
    return (
      <Alert severity="warning" sx={{ mb: 3 }} action={
        <IconButton size="small" onClick={() => load()} aria-label="Retry">
          <RefreshOutlinedIcon fontSize="small" />
        </IconButton>
      }>
        Could not load mukkadam deployment counts: {error}
      </Alert>
    );
  }

  const totalDeployed = counts?.total_deployed ?? 0;
  const activeCount = counts?.by_status?.active?.total ?? 0;
  
  const permanentTotal = counts?.by_team_type?.permanent ?? 0;
  const permanentActive = counts?.by_status?.active?.permanent ?? 0;

  const upDownTotal = counts?.by_team_type?.up_down ?? 0;
  const upDownActive = counts?.by_status?.active?.up_down ?? 0;

  const bankHasAccount = counts?.bank_account?.has_bank_account ?? 0;
  const bankTotal = bankHasAccount + (counts?.bank_account?.no_bank_account ?? 0);

  const tenderSigned = counts?.tender_signed?.signed ?? 0;
  const tenderTotal = tenderSigned + (counts?.tender_signed?.not_signed ?? 0);

  const metrics = [
    {
      label: "Active Mukkadams",
      value: activeCount,
      total: totalDeployed,
      caption: "Currently active overall",
      icon: CheckCircleOutlineOutlined,
      color: "success.main",
      bgLight: "success.lighter",
    },
    {
      label: "Permanent Mukkadams",
      value: permanentActive,
      total: permanentTotal,
      caption: "Active / Total permanent",
      icon: BadgeOutlinedIcon,
      color: "info.main",
    },
    {
      label: "Up / Down Mukkadams",
      value: upDownActive,
      total: upDownTotal,
      caption: "Active / Total up & down",
      icon: SwapVertOutlinedIcon,
      color: "warning.main",
    },
    {
      label: "Bank Coverage",
      value: bankHasAccount,
      total: bankTotal,
      caption: "Have details on file",
      icon: AccountBalanceOutlinedIcon,
      color: "primary.main",
    },
    // {
    //   label: "Tender Agreement",
    //   value: tenderSigned,
    //   total: tenderTotal,
    //   caption: "Tender signed",
    //   icon: FactCheckOutlinedIcon,
    //   color: "secondary.main",
    // },
  ];

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Mukkadam Deployment Metrics
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Tooltip title="Refresh">
            <span>
              <IconButton size="small" onClick={() => load()} disabled={loading} aria-label="Refresh counts">
                <RefreshOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Typography
            component={RouterLink}
            to="/mukkadams"
            variant="body2"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              color: "primary.main",
              textDecoration: "none",
              fontWeight: 600,
              "&:hover": { textDecoration: "underline" },
            }}
          >
            View directory <ArrowForwardIcon sx={{ fontSize: 16 }} />
          </Typography>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
            lg: "repeat(5, 1fr)",
          },
        }}
      >
        {metrics.map((metric, index) => {
          const IconComponent = metric.icon;
          return (
            <Card
              key={index}
              variant="outlined"
              sx={{
                transition: "all 0.2s ease-in-out",
                "&:hover": {
                  transform: "translateY(-3px)",
                  boxShadow: (t) => t.shadows[2],
                  borderColor: metric.color,
                },
              }}
            >
              <CardContent sx={{ py: 2, px: 2.5, "&:last-child": { pb: 2 } }}>
                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    {metric.label}
                  </Typography>
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: 1.5,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: (t) => t.palette.action.hover,
                      color: metric.color,
                    }}
                  >
                    <IconComponent fontSize="small" />
                  </Box>
                </Stack>
                
                {loading ? (
                  <Skeleton variant="text" width={60} height={36} />
                ) : (
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2, color: metric.color }}>
                      {metric.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                      / {metric.total}
                    </Typography>
                  </Box>
                )}

                <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.5 }}>
                  {metric.caption}
                </Typography>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}