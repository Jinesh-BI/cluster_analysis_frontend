// src/hooks/useClusterVault.js
//
// Fetches this cluster's farmer vault data once and derives credit/debit
// totals from it — lifted out of ClusterVault itself so ClusterDetailPage
// can read the same `debit` figure for the cluster financial summary
// (revenue actually served — see ClusterFinancialSummary) without a
// second fetch of the same endpoint.
//
// CREDIT = a farmer topping up their vault (money in, not yet earned).
// DEBIT = vault money spent to pay for a completed activity (money the
// farmer's service has actually consumed — this is the "revenue served"
// figure). `total_balance` (credit - debit) is the vault's own already-
// displayed "what's still sitting there unspent" figure, kept separate.
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

export function useClusterVault(clusterId) {
  const [vault, setVault] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setVault(null);
    setError(null);
    api
      .getClusterVault(clusterId)
      .then(setVault)
      .catch((e) => setError(e.message));
  }, [clusterId]);

  const totals = useMemo(() => {
    let credit = 0;
    let debit = 0;
    for (const f of vault?.farmers ?? []) {
      for (const t of f.transactions ?? []) {
        if (t.type === "CREDIT") credit += Number(t.amount) || 0;
        else debit += Number(t.amount) || 0;
      }
    }
    return { credit, debit, balance: vault?.total_balance ?? 0 };
  }, [vault]);

  return { vault, error, totals };
}
