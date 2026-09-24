// src/pages/ManagersPage.jsx
import { useEffect, useState } from "react";
import { usePostHog } from "@posthog/react";
import { Link } from "react-router-dom";
import { track, trackException } from "../analytics/track";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function ManagersPage() {
  const posthog = usePostHog();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [managers, setManagers] = useState(null);
  const [form, setForm] = useState({ username: "", password: "", phone_number: "" });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [globalHolidays, setGlobalHolidays] = useState(null);
  const [holidayForm, setHolidayForm] = useState({ label: "", start_date: "", end_date: "" });
  const [savingHoliday, setSavingHoliday] = useState(false);

  function load() {
    api.getManagers().then(setManagers).catch((e) => setError(e.message));
  }

  function loadHolidays() {
    api.getGlobalHolidays().then(setGlobalHolidays).catch(() => setGlobalHolidays([]));
  }

  useEffect(load, []);
  useEffect(loadHolidays, []);

  async function handleAddHoliday(e) {
    e.preventDefault();
    setSavingHoliday(true);
    setError(null);
    try {
      await api.addGlobalHoliday(holidayForm);
      track(posthog, "global_holiday_added", {
        actor_role: user?.role,
        spans_multiple_days: holidayForm.start_date !== holidayForm.end_date,
      });
      setHolidayForm({ label: "", start_date: "", end_date: "" });
      loadHolidays();
    } catch (err) {
      trackException(posthog, err);
      track(posthog, "global_holiday_add_failed", { actor_role: user?.role });
      setError(err.message);
    } finally {
      setSavingHoliday(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createManager(form);
      track(posthog, "manager_created", {
        actor_role: user?.role,
        created_role: "OPERATIONS_MANAGER",
        phone_number_provided: Boolean(form.phone_number),
      });
      setForm({ username: "", password: "", phone_number: "" });
      load();
    } catch (err) {
      trackException(posthog, err);
      track(posthog, "manager_create_failed", { actor_role: user?.role });
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/" className="btn" style={{ marginBottom: 8, display: "inline-block" }}>
            ← Back
          </Link>
          <h1>Operations Managers (OM)</h1>
        </div>
      </div>

      <form className="form-stack" onSubmit={handleSubmit} style={{ marginBottom: 28 }}>
        <input
          className="input"
          placeholder="Username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <input
          className="input"
          placeholder="Phone number (optional)"
          value={form.phone_number}
          onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
        />
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary" disabled={saving}>
          {saving ? "Creating…" : "Create OM"}
        </button>
      </form>

      <h3>Existing</h3>
      {!managers && <p className="muted">Loading…</p>}
      {managers?.length === 0 && <p className="muted">None yet.</p>}
      <ul>
        {managers?.map((m) => (
          <li key={m.id}>
            {m.username} — {m.phone_number || "no phone on file"}
          </li>
        ))}
      </ul>

      {isAdmin && (
        <>
          <h3 style={{ marginTop: 28 }}>Global holidays</h3>
          <p className="muted">
            Applies to every cluster&apos;s calendar — e.g. Diwali. Cluster-specific holidays are added from each
            cluster&apos;s own page instead.
          </p>
          <form className="form-stack" onSubmit={handleAddHoliday} style={{ marginBottom: 16, maxWidth: 420 }}>
            <input
              className="input"
              placeholder="Label (e.g. Diwali)"
              value={holidayForm.label}
              onChange={(e) => setHolidayForm({ ...holidayForm, label: e.target.value })}
              required
            />
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                type="date"
                value={holidayForm.start_date}
                onChange={(e) => setHolidayForm({ ...holidayForm, start_date: e.target.value })}
                required
              />
              <input
                className="input"
                type="date"
                value={holidayForm.end_date}
                onChange={(e) => setHolidayForm({ ...holidayForm, end_date: e.target.value })}
                required
              />
            </div>
            <button className="btn btn-primary" disabled={savingHoliday}>
              {savingHoliday ? "Saving…" : "Add global holiday"}
            </button>
          </form>
          {!globalHolidays && <p className="muted">Loading…</p>}
          {globalHolidays?.length === 0 && <p className="muted">None yet.</p>}
          <ul>
            {globalHolidays?.map((h) => (
              <li key={h.id}>
                {h.label} — {h.start_date} to {h.end_date}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
