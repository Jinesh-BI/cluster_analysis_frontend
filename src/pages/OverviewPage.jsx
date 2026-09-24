// src/pages/OverviewPage.jsx
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { usePostHog } from "@posthog/react";
import { Box, Chip, IconButton, InputAdornment, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import { api } from "../api/client";
import ClusterCard from "../components/ClusterCard";
import DelegationOverview from "../components/DelegationOverview";
// import TodayTomorrowActivities from "../components/TodayTomorrowActivities";
import MukkadamJobsBoard from "../components/MukkadamJobsBoard";
import MukkadamStatsTiles from "../components/mukkadams/MukkadamStatsTiles";
import { useAuth } from "../context/AuthContext";
import { track, useDebouncedTrack } from "../analytics/track";

export default function OverviewPage() {
  const posthog = usePostHog();
  const [clusters, setClusters] = useState(null);
  const [error, setError] = useState(null);
  const [oms, setOms] = useState(null);
  const [omFilter, setOmFilter] = useState("");
  const [clusterQuery, setClusterQuery] = useState("");
  const deferredClusterQuery = useDeferredValue(clusterQuery);
  const { user, isManagerTier } = useAuth();

  useDebouncedTrack(posthog, "overview_cluster_search_applied", clusterQuery);

  // Client-side name filter layered on top of the server-side OM filter —
  // doesn't touch `clusters` itself, so nothing else that reads it
  // (counts, DelegationOverview, etc.) is affected.
  const filteredClusters = useMemo(() => {
    const q = deferredClusterQuery.trim().toLowerCase();
    if (!q) return clusters;
    return clusters?.filter((c) => c.name?.toLowerCase().includes(q));
  }, [clusters, deferredClusterQuery]);

  // Only Admin/AM get the "filter by OM" dropdown — an OM already only
  // ever sees their own clusters, so there's nothing for them to narrow.
  useEffect(() => {
    if (!isManagerTier) return;
    api
      .getManagers()
      .then((list) => setOms(list.filter((m) => m.role === "ASSISTANT_REGIONAL_MANAGER")))
      .catch(() => setOms([]));
  }, [isManagerTier]);

  useEffect(() => {
    api.getClusters(omFilter || undefined).then(setClusters).catch((e) => setError(e.message));
  }, [omFilter]);

  return (
    <div className="page">
      <MukkadamStatsTiles />

      {/* <TodayTomorrowActivities /> */}
      <MukkadamJobsBoard />

      {user?.role === "REGIONAL_MANAGER" && <DelegationOverview />}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", mt: 3, mb: 1.5 }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Clusters
          </Typography>
          {clusters && clusters.length > 0 && (
            <Chip
              size="small"
              variant="outlined"
              color={deferredClusterQuery.trim() || omFilter ? "primary" : "default"}
              label={
                deferredClusterQuery.trim()
                  ? `${filteredClusters?.length ?? 0} of ${clusters.length}`
                  : clusters.length
              }
            />
          )}
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ width: { xs: "100%", sm: "auto" } }}>
          {isManagerTier && oms && oms.length > 0 && (
            <Select
              size="small"
              displayEmpty
              value={omFilter}
              onChange={(e) => {
                setOmFilter(e.target.value);
                track(posthog, "overview_om_filter_applied", { has_filter: Boolean(e.target.value) });
              }}
              aria-label="Filter by OM"
              sx={{ minWidth: { sm: 190 } }}
              renderValue={(value) => {
                const selected = oms.find((om) => om.id === value);
                return (
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <PersonOutlineOutlinedIcon fontSize="small" sx={{ color: "text.secondary" }} />
                    <span>{selected ? selected.username : "All OMs"}</span>
                  </Stack>
                );
              }}
            >
              <MenuItem value="">All OMs</MenuItem>
              {oms.map((om) => (
                <MenuItem key={om.id} value={om.id}>
                  {om.username}
                </MenuItem>
              ))}
            </Select>
          )}

          <TextField
            placeholder="Search clusters by name…"
            value={clusterQuery}
            onChange={(e) => setClusterQuery(e.target.value)}
            size="small"
            sx={{ width: { xs: "100%", sm: 260 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: clusterQuery && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => {
                        track(posthog, "overview_cluster_search_cleared");
                        setClusterQuery("");
                      }}
                      aria-label="Clear search"
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </Stack>
      </Stack>

      {error && <p className="error-text">{error}</p>}
      {!clusters && !error && <p className="muted">Loading clusters…</p>}
      {clusters && clusters.length === 0 && (
        <p className="muted">No clusters assigned to you yet.</p>
      )}
      {clusters && clusters.length > 0 && filteredClusters?.length === 0 && (
        <Box sx={{ py: 2 }}>
          <Typography color="text.secondary">
            No clusters match “{deferredClusterQuery.trim()}”.
          </Typography>
        </Box>
      )}

      <div className="cluster-grid">
        {filteredClusters?.map((cluster) => (
          <ClusterCard key={cluster.id} cluster={cluster} />
        ))}
      </div>
    </div>
  );
}
