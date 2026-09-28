// src/hooks/useClusterCosts.js
//
// Fetches this cluster's total logged operating spend (shed/travel/
// essentials/labor, pending or approved alike) — lifted out of
// ClusterFinancialSummary so ClusterDetailPage can also read it for the
// top-of-page "Net value" stat card without a second fetch of the same
// endpoint. ClusterCosts itself keeps its own separate fetch — it also
// owns the add-cost form's list/reload cycle, which this hook doesn't
// need to duplicate.
import { useEffect, useState } from "react";
import { api } from "../api/client";

export function useClusterCosts(clusterId, deployed) {
  const [totalSpent, setTotalSpent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!deployed) return;
    setTotalSpent(null);
    setError(null);
    api
      .getClusterCosts(clusterId)
      .then((res) => setTotalSpent(res.total_spent || 0))
      .catch((e) => setError(e.message));
  }, [clusterId, deployed]);

  return { totalSpent, error };
}
