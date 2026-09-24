// src/components/ClusterCosts.jsx
//
// Money spent running the cluster — shed, travel, essentials, labor,
// etc. Separate from farmer bookings/payments. Loads on mount, and the
// add-cost form refreshes the list on success.

import { useEffect, useState } from "react";
import { usePostHog } from "@posthog/react";
import { api } from "../api/client";
import { formatCurrency } from "../utils/format";
import { track, trackException } from "../analytics/track";

const PRESET_CATEGORIES = ["Shed", "Essentials", "Travel", "Labor"];

export default function ClusterCosts({ clusterId }) {
  const posthog = usePostHog();
  const [costs, setCosts] = useState(null);
  const [totalSpent, setTotalSpent] = useState(0);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [category, setCategory] = useState(PRESET_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  function load() {
    api
      .getClusterCosts(clusterId)
      .then((res) => {
        setCosts(res.costs);
        setTotalSpent(res.total_spent);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    setCosts(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterId]);

  async function handleSubmit(e) {
    e.preventDefault();
    const finalCategory = category === "Other" ? customCategory.trim() : category;
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
      track(posthog, "cluster_cost_log_failed", { cluster_id: clusterId });
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <p className="error-text">{error}</p>;

  return (
    <div className="info-card">
      <div className="info-card__title-row">
        <div className="info-card__title">Cluster costs</div>
        <div className="stat-box__value" style={{ fontSize: 16 }}>
          {formatCurrency(totalSpent)}
        </div>
      </div>

      {costs === null && <p className="muted">Loading…</p>}
      {costs?.length === 0 && !showForm && <p className="muted">Nothing logged yet.</p>}

      {costs?.map((c) => (
        <div className="cost-item" key={c.id}>
          <div>
            <strong>{c.category}</strong>
            {c.note && <span className="muted"> — {c.note}</span>}
            <div className="muted">
              {c.created_by_name || "Unknown"} • {c.created_at?.slice(0, 10)}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>{formatCurrency(c.amount_spent)}</span>
            <span className={`status-pill ${c.request_approved ? "status-pill--paid" : "status-pill--pending"}`}>
              {c.request_approved ? "Approved" : "Pending"}
            </span>
          </div>
        </div>
      ))}

      {!showForm && (
        <button className="btn" style={{ marginTop: 10 }} onClick={() => setShowForm(true)}>
          Log a cost
        </button>
      )}

      {showForm && (
        <form className="form-stack" style={{ marginTop: 12 }} onSubmit={handleSubmit}>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {PRESET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="Other">Other…</option>
          </select>
          {category === "Other" && (
            <input
              className="input"
              placeholder="Category name"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
            />
          )}
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount spent (₹)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            className="input"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {formError && <p className="error-text">{formError}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save cost"}
            </button>
            <button className="btn" type="button" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}