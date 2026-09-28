// src/hooks/useClusterMukkadamPayouts.js
//
// Fetches this cluster's farmer -> mukkadam payout data (reference/
// am_integration_docs.md §11) and re-groups it by mukkadam_id instead of
// farmer_id — "which mukkadams worked this cluster, and what did each
// earn here," the mirror image of MukkadamCard's other half (the farmer
// vault, "money in"). A hook rather than baking the fetch into the
// component so MukkadamCard's header (title-row total, matching
// ClusterVault's own title-row) and the row list below it can both read
// from the same totals without two separate fetches.
import { useEffect, useMemo, useState } from "react";
import { mukkadamIntegrationApi } from "../api/mukkadamIntegrationClient";

function regroupByMukkadam(results) {
  const byId = new Map();
  for (const farmerResult of results) {
    for (const alloc of farmerResult.allocations) {
      if (!byId.has(alloc.mukkadam_id)) {
        byId.set(alloc.mukkadam_id, {
          mukkadam_id: alloc.mukkadam_id,
          mukkadam_name: alloc.mukkadam_name,
          total_allocations: 0,
          total_actual_acres: 0,
          total_payout: 0,
          allocations: [],
        });
      }
      const group = byId.get(alloc.mukkadam_id);
      group.total_allocations += 1;
      group.total_actual_acres += alloc.actual?.area || 0;
      group.total_payout += alloc.actual?.amount || 0;
      group.allocations.push({ ...alloc, farmer_id: farmerResult.farmer_id, farmer_name: farmerResult.farmer_name });
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.total_payout - a.total_payout);
}

export function useClusterMukkadamPayouts(farmerIds) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!farmerIds?.length) {
      setData(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    mukkadamIntegrationApi
      .getFarmerMukkadamPayouts(farmerIds, controller.signal)
      .then(setData)
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [farmerIds]);

  const mukkadamGroups = useMemo(() => regroupByMukkadam(data?.results ?? []), [data]);

  const totals = useMemo(
    () => ({
      allocations: mukkadamGroups.reduce((sum, g) => sum + g.total_allocations, 0),
      acres: mukkadamGroups.reduce((sum, g) => sum + g.total_actual_acres, 0),
      payout: mukkadamGroups.reduce((sum, g) => sum + g.total_payout, 0),
      mukkadamCount: mukkadamGroups.length,
    }),
    [mukkadamGroups],
  );

  return {
    loading,
    error,
    seasonCode: data?.season_code,
    notFoundFarmerIds: data?.not_found_farmer_ids ?? [],
    mukkadamGroups,
    totals,
  };
}
