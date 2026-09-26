// src/pages/ClusterPlaygroundPageV2.jsx
//
// ClusterPlaygroundPage's restyled board UI (farmer "calls to make" cards,
// per-plot mini-month picker with move-impact preview, late-starts/idle-
// windows sidebar), extended with prod_clusterPlayground.jsx's working
// functionality: admin-only override for completed work, percent-based
// partial piece moves, unschedule (single + bulk), holiday awareness, a
// real publish flow, and the fill-rate stat. Saving persists to
// ClusterSchedule; it never touches Activity.date_time.
//
// Deliberately NOT ported (see the migration plan doc): mukkadam
// allocation, the auto-allocate cascade, and the "spread view" checkboxes
// — none of those are wired to working API/UI in this codebase today.

import { useEffect, useMemo, useRef, useState, useReducer } from "react";
import { usePostHog } from "@posthog/react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import { track, trackException, trackGroup, useDebouncedTrack } from "../analytics/track";
import PlaygroundCalendar from "../components/PlaygroundCalendar";
import FillRateDetail from "../components/FillRateDetail";
import { EmptyState, ErrorState, LoadingState } from "../components/FeedbackStates";
import { useAuth } from "../context/AuthContext";
import { holidayDateMap } from "../utils/dates";

// The planning horizon: the current month plus the next three. Earlier
// months are history — they're not shown and can't be planned into.
const PLANNING_MONTHS = 4;

function monthKey(date) {
  return date.getFullYear() * 12 + date.getMonth();
}

function planWindow(today = new Date()) {
  return {
    start: new Date(today.getFullYear(), today.getMonth(), 1),
    end: new Date(today.getFullYear(), today.getMonth() + PLANNING_MONTHS, 0),
  };
}

// ---------------------------------------------------------------------
// Plan state: one entry per origin activity ("block"), keyed by
// activity_id. Each block holds `pieces`, a list that always sums to
// 100%: [{piece_id, percent, date}].
// ---------------------------------------------------------------------

function buildInitialPlan(blocksFromApi, savedPiecesByActivityId) {
  const plan = {};
  for (const b of blocksFromApi) {
    const saved = savedPiecesByActivityId[b.activity_id];
    plan[b.activity_id] = {
      ...b,
      pieces:
        saved && saved.length > 0
          ? saved.map((p, i) => ({ piece_id: `${b.activity_id}-saved-${i}`, percent: p.percent, date: p.date }))
          : [{ piece_id: `${b.activity_id}-orig`, percent: 100, date: b.date || null }],
    };
  }
  return plan;
}

function mergePieces(pieces) {
  const byKey = new Map();
  for (const p of pieces) {
    const key = p.date ?? "__unscheduled__";
    if (byKey.has(key)) {
      byKey.get(key).percent = Math.round((byKey.get(key).percent + p.percent) * 100) / 100;
    } else {
      byKey.set(key, { ...p });
    }
  }
  return [...byKey.values()].filter((p) => p.percent > 0);
}

function planReducer(state, action) {
  switch (action.type) {
    case "INIT":
      return buildInitialPlan(action.blocks, action.savedPieces);

    case "SPLIT": {
      const { activityId, pieceId, movePercent, targetDate, allowCompleted } = action;
      const block = state[activityId];
      // Completed work can't be rescheduled — unless an admin explicitly
      // allowed it (see the isAdmin plumbing in the page component).
      if (!block || (block.completed && !allowCompleted)) return state;
      const pieces = block.pieces;
      const idx = pieces.findIndex((p) => p.piece_id === pieceId);
      if (idx === -1) return state;
      const piece = pieces[idx];
      if (movePercent <= 0 || movePercent > piece.percent) return state;

      let nextPieces;
      if (movePercent === piece.percent) {
        nextPieces = pieces.map((p, i) => (i === idx ? { ...p, date: targetDate } : p));
      } else {
        const remainder = { ...piece, percent: Math.round((piece.percent - movePercent) * 100) / 100 };
        const moved = { piece_id: `${activityId}-${Date.now()}`, percent: movePercent, date: targetDate };
        nextPieces = [...pieces.slice(0, idx), remainder, moved, ...pieces.slice(idx + 1)];
      }

      return { ...state, [activityId]: { ...block, pieces: mergePieces(nextPieces) } };
    }

    // Clears every non-completed block back to a single 100% unscheduled
    // piece, so planning can start fresh. Completed activities are never
    // touched here, admin or not.
    case "UNSCHEDULE_ALL": {
      const next = {};
      for (const [activityId, block] of Object.entries(state)) {
        if (block.completed) {
          next[activityId] = block;
          continue;
        }
        next[activityId] = {
          ...block,
          pieces: [{ piece_id: `${activityId}-unscheduled-${Date.now()}`, percent: 100, date: null }],
        };
      }
      return next;
    }

    default:
      return state;
  }
}

function indexSavedPieces(scheduleData) {
  const map = {};
  for (const entry of scheduleData || []) {
    map[entry.activity_id] = entry.pieces || [];
  }
  return map;
}

function parseLocalDate(dateString) {
  if (!dateString) return null;
  return new Date(`${dateString}T00:00:00`);
}

function diffDays(fromDate, toDate) {
  const from = parseLocalDate(fromDate);
  const to = parseLocalDate(toDate);
  if (!from || !to) return 0;
  return Math.round((to - from) / 86400000);
}

function formatPlanDate(dateString) {
  const date = parseLocalDate(dateString);
  if (!date) return "Unscheduled";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// Publish's response can carry a `mukkadam_allocations_push` summary —
// the result of pushing this schedule's mukkadam allocations out to the
// tender side. Maps its overall `status` onto the existing status-pill
// palette so it reads consistently with every other pill on the page.
function mukkadamPushStatusClass(status) {
  switch (status) {
    case "SUCCESS":
      return "status-pill--paid";
    case "PARTIAL":
      return "status-pill--pending";
    case "FAILED":
      return "status-pill--overdue";
    default:
      return "";
  }
}

// One line per allocation the push attempted — "Activity 30017 ·
// Mukkadam 9002008" — used to label both success and error rows.
function mukkadamPushRowLabel(result) {
  const parts = [];
  if (result.api_activity_id != null) parts.push(`Activity ${result.api_activity_id}`);
  if (result.mukkadam_id != null) parts.push(`Mukkadam ${result.mukkadam_id}`);
  return parts.join(" · ") || "Allocation";
}

function mukkadamPushRowMessage(result) {
  if (result.status === "error") return result.message || result.code || "Could not push this allocation.";
  if (result.status === "created") return "Allocation created.";
  if (result.status === "updated") return "Allocation updated.";
  return result.message || result.status;
}

// The block's current proposed date — the earliest of its (usually one)
// pieces, falling back to its real API date.
function effectiveDate(block) {
  const scheduled = [...(block?.pieces || [])].filter((p) => p.date).sort((a, b) => a.date.localeCompare(b.date));
  return scheduled[0]?.date || block?.date || null;
}

function farmerKeyOf(block) {
  return block.farmer_id || block.farmer_name || "unknown";
}

function toISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(dateString, delta) {
  const date = parseLocalDate(dateString);
  if (!date) return dateString;
  date.setDate(date.getDate() + delta);
  return toISODate(date);
}

function dateListBetween(startDate, endDate) {
  if (!startDate || !endDate) return [];
  const days = [];
  const cursor = new Date(startDate);
  const end = new Date(endDate);
  while (cursor <= end) {
    days.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

// Collapses a sorted list of idle ISO dates into contiguous windows,
// e.g. ["2026-11-03".."2026-11-11"] instead of nine separate rows.
function groupIdleRanges(sortedDates) {
  const ranges = [];
  let start = null;
  let prev = null;
  for (const d of sortedDates) {
    if (!start) {
      start = d;
      prev = d;
      continue;
    }
    if (diffDays(prev, d) === 1) {
      prev = d;
      continue;
    }
    ranges.push({ start, end: prev });
    start = d;
    prev = d;
  }
  if (start) ranges.push({ start, end: prev });
  return ranges;
}

// A rich list-style picker for choosing a mukkadam. A plain <select> can
// only show one line of text per option, which isn't enough room for a
// name, a crew size, and a deployment-status tag — so this is a small
// custom combobox instead: a trigger button that mirrors the chosen
// mukkadam, and a searchable floating list of cards below it, each row
// showing the mukkadam's name, crew size, and a "Permanent" / "Up/Down"
// tag driven by `is_permanent`.
function MukkadamPicker({ mukkadams, value, onChange, disabled, placeholder = "Choose a mukkadam…" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handleOutsideClick(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const list = mukkadams || [];
  const selected = list.find((m) => String(m.mukkadam_id) === String(value));
  const term = query.trim().toLowerCase();
  const filtered = term ? list.filter((m) => (m.mukkadam_name || "").toLowerCase().includes(term)) : list;

  function pick(mukkadam) {
    onChange(String(mukkadam.mukkadam_id));
    setOpen(false);
  }

  return (
    <div className={`mukkadam-picker ${disabled ? "mukkadam-picker--disabled" : ""}`} ref={wrapRef}>
      <button
        type="button"
        className="input mukkadam-picker__trigger"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <span className="mukkadam-picker__selected">
            <strong>{selected.mukkadam_name}</strong>
            <span className="muted">Crew of {selected.crew_size ?? "—"}</span>
            <span className={`mukkadam-tag ${selected.is_permanent ? "mukkadam-tag--permanent" : "mukkadam-tag--updown"}`}>
              {selected.is_permanent ? "Permanent" : "Up/Down"}
            </span>
          </span>
        ) : (
          <span className="mukkadam-picker__placeholder">{placeholder}</span>
        )}
        <i className="mukkadam-picker__chevron" aria-hidden="true">
          &#9662;
        </i>
      </button>

      {open && (
        <div className="mukkadam-picker__panel" role="listbox" aria-label="Mukkadams">
          <input
            type="text"
            className="mukkadam-picker__search"
            placeholder="Search mukkadams…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
          <div className="mukkadam-picker__list">
            {filtered.length === 0 && <div className="mukkadam-picker__empty">No mukkadams match.</div>}
            {filtered.map((m) => {
              const isSelected = String(m.mukkadam_id) === String(value);
              return (
                <button
                  type="button"
                  key={m.mukkadam_id}
                  role="option"
                  aria-selected={isSelected}
                  className={`mukkadam-option ${isSelected ? "mukkadam-option--selected" : ""}`}
                  onClick={() => pick(m)}
                >
                  <span className="mukkadam-option__avatar" aria-hidden="true">
                    {(m.mukkadam_name || "?").trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="mukkadam-option__main">
                    <strong>{m.mukkadam_name}</strong>
                    <small>Crew of {m.crew_size ?? "—"}</small>
                  </span>
                  <span className={`mukkadam-tag ${m.is_permanent ? "mukkadam-tag--permanent" : "mukkadam-tag--updown"}`}>
                    {m.is_permanent ? "Permanent" : "Up/Down"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Clicking the row opens an inline "allocate a mukkadam to this piece"
// panel: pick how much of it (25/50/75/100%) and who's doing it. Percent
// + mukkadam is all the form collects — cluster_id and activity_id are
// already known, and this row's `date` IS the piece_date (rows here only
// ever come from placementsByDate[selectedDate]).
//
// Who's already allocated comes from the page's `dayAllocations` (fetched
// from the calendar-day endpoint — the only place allocations are
// readable), keyed to this exact day, so re-opening a row later shows the
// real state, not just what was added this session. It's deliberately
// orthogonal to the plan/schedule state: allocating or unassigning never
// touches `plan`, `hasUnsavedChanges`, save, or publish.
function PlanningActivityRow({
  block,
  date,
  note,
  deployedMukkadams,
  onAllocateMukkadam,
  onUnassignMukkadam,
  dayAllocations,
  dayAllocationsLoading,
  disabledReason,
  isAdmin,
}) {
  const posthog = usePostHog();
  const [open, setOpen] = useState(false);
  const [pickedMukkadamId, setPickedMukkadamId] = useState("");
  const [pickedPercent, setPickedPercent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [formError, setFormError] = useState(null);

  const hasFreshData = Boolean(dayAllocations && dayAllocations.day === date);
  const existingAllocations = hasFreshData ? dayAllocations.byActivity[block.activity_id] || [] : [];
  const allocatedPercent = existingAllocations.reduce((sum, a) => sum + (a.percent || 0), 0);
  const remainingPercent = Math.max(0, 100 - allocatedPercent);
  const percentOptions = [25, 50, 75, 100].filter((p) => p <= remainingPercent);
  const alreadyAllocatedIds = new Set(existingAllocations.map((a) => String(a.mukkadam_id)));
  const availableMukkadams = (deployedMukkadams || []).filter((m) => !alreadyAllocatedIds.has(String(m.mukkadam_id)));

  // Mukkadams can only be allocated to today or a future date — the crew
  // hasn't shown up yet to be assigned on a day that's already gone. Only
  // an admin can override that and still allocate/unassign on a past day.
  // Either way, who's already allocated on a past day still reads and
  // shows in full (chips) — it's just the write actions that are gated.
  const isPastDate = Boolean(date && date < toISODate(new Date()));
  const pastDateLockedForRole = isPastDate && !isAdmin;
  const effectiveDisabledReason = pastDateLockedForRole
    ? "This date has already passed — only an admin can allocate mukkadams for a past date."
    : disabledReason;

  async function handleAllocate() {
    const mukkadam = availableMukkadams.find((m) => String(m.mukkadam_id) === pickedMukkadamId);
    const percent = pickedPercent || percentOptions[percentOptions.length - 1];
    if (!mukkadam || !percent || !date || !onAllocateMukkadam) return;
    setSaving(true);
    setFormError(null);
    const result = await onAllocateMukkadam(block.activity_id, date, mukkadam, percent);
    setSaving(false);
    if (result?.ok) {
      track(posthog, "mukkadam_allocated_in_planner", { activity_id: block.activity_id, mukkadam_id: mukkadam.mukkadam_id, percent });
      setPickedMukkadamId("");
      setPickedPercent(null);
    } else {
      setFormError(result?.error || "Could not allocate this mukkadam.");
    }
  }

  async function handleUnassign(allocationId) {
    if (!onUnassignMukkadam) return;
    setRemovingId(allocationId);
    setFormError(null);
    const result = await onUnassignMukkadam(date, allocationId);
    setRemovingId(null);
    if (result?.ok) {
      track(posthog, "mukkadam_unassigned_in_planner", { activity_id: block.activity_id, allocation_id: allocationId });
    } else {
      setFormError(result?.error || "Could not remove this allocation.");
    }
  }

  return (
    <div className="planning-activity-row-wrap">
      <div
        className="planning-activity-row planning-activity-row--clickable"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen((v) => !v);
          }
        }}
      >
        <span className="planning-activity-row__mark" />
        <span className="planning-activity-row__plot">{block.plot_id || "-"}</span>
        <span className="planning-activity-row__name">
          <strong>{block.activity_name || "Unnamed activity"}</strong>
          <small>{block.farmer_name}</small>
        </span>
        <span className="planning-activity-row__note">{note || (date ? formatPlanDate(date) : "Not placed")}</span>
      </div>

      {open && (
        <div className="mukkadam-allocate-panel" onClick={(event) => event.stopPropagation()}>
          {dayAllocationsLoading && !hasFreshData && (
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              Checking current allocations…
            </p>
          )}

          {existingAllocations.length > 0 && (
            <div className="mukkadam-chips">
              {existingAllocations.map((a) => (
                <span className="mukkadam-chip" key={a.allocation_id}>
                  {a.mukkadam_name || a.mukkadam_id} &bull; {a.percent}%
                  {onUnassignMukkadam && (
                    <button
                      type="button"
                      className="mukkadam-chip__remove"
                      onClick={() => handleUnassign(a.allocation_id)}
                      disabled={removingId === a.allocation_id || pastDateLockedForRole}
                      title={pastDateLockedForRole ? "Only an admin can remove an allocation for a past date." : "Remove this mukkadam"}
                      aria-label={`Remove ${a.mukkadam_name || "this mukkadam"}`}
                    >
                      {removingId === a.allocation_id ? "…" : "×"}
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {isPastDate && isAdmin && (
            <span className="status-pill status-pill--pending" style={{ alignSelf: "flex-start" }}>
              Admin override — past date
            </span>
          )}

          {!date ? (
            <p className="muted" style={{ margin: 0 }}>
              This activity isn&apos;t placed on a day yet.
            </p>
          ) : effectiveDisabledReason ? (
            <p className="muted" style={{ margin: 0 }}>
              {effectiveDisabledReason}
            </p>
          ) : remainingPercent <= 0 ? (
            <span className="muted">Fully allocated</span>
          ) : (
            <div className="mukkadam-add-row">
              <MukkadamPicker
                mukkadams={availableMukkadams}
                value={pickedMukkadamId}
                onChange={setPickedMukkadamId}
              />
              <select
                className="input piece-row__select"
                value={pickedPercent || percentOptions[percentOptions.length - 1]}
                onChange={(event) => setPickedPercent(Number(event.target.value))}
                aria-label="Percent of this activity"
              >
                {percentOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}%
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-primary" onClick={handleAllocate} disabled={!pickedMukkadamId || saving}>
                {saving ? "Allocating…" : "Allocate"}
              </button>
            </div>
          )}

          {formError && (
            <p className="error-text" style={{ margin: 0 }}>
              {formError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// One row per PLOT, the way the reference board does it: a plot's whole
// activity chain moves together, anchored on its earliest activity.
function groupPlotsForFarmer(blocks) {
  const byPlot = new Map();
  for (const block of blocks) {
    const key = block.plot_id || "-";
    if (!byPlot.has(key)) byPlot.set(key, []);
    byPlot.get(key).push(block);
  }
  return [...byPlot.entries()].map(([plotId, plotBlocks]) => {
    const sorted = [...plotBlocks].sort((a, b) => (effectiveDate(a) || "").localeCompare(effectiveDate(b) || ""));
    const said = plotBlocks.map((b) => b.date).filter(Boolean).sort()[0] || null;
    const want = plotBlocks.map((b) => effectiveDate(b)).filter(Boolean).sort()[0] || null;
    return {
      plotId,
      blocks: sorted,
      acres: Number(sorted[0]?.acres || 0),
      variety: sorted.find((b) => b.variety)?.variety || null,
      said,
      want,
      shift: said && want ? diffDays(said, want) : 0,
    };
  });
}

// The picker only ever shows months inside the planning window, and
// only navigates within it — there's no going back before this month.
function buildWindowMonth(windowStart, windowEnd, focusDate, monthOffset) {
  if (!windowStart || !windowEnd) return null;
  const startKey = monthKey(windowStart);
  const count = monthKey(windowEnd) - startKey + 1;
  const focus = parseLocalDate(focusDate);
  const focusIndex = focus ? Math.min(Math.max(monthKey(focus) - startKey, 0), count - 1) : 0;
  const index = Math.min(Math.max(focusIndex + monthOffset, 0), count - 1);
  const key = startKey + index;
  const year = Math.floor(key / 12);
  const month = key % 12;
  const base = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < base.getDay(); i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  return { label: base.toLocaleDateString("en-IN", { month: "long", year: "numeric" }), cells, index, count };
}

function orderedByDate(plotBlocks) {
  return [...plotBlocks].sort((a, b) => (effectiveDate(a) || "").localeCompare(effectiveDate(b) || ""));
}

// The single source of truth for what a date change does — used for the
// hover preview AND the committed move, so the two can never disagree.
//
// activityId === null  -> move the whole plot: every movable activity
//                         shifts by the same delta, keeping its spacing.
// activityId set       -> move just that activity. Following, movable
//                         activities carry along by the same delta,
//                         keeping the plot's spacing. Moving earlier is
//                         clamped to its predecessor's date. Earlier
//                         activities are never touched.
//
// lockedIds are completed activities a non-admin can't move — the
// reducer already refuses to write those, but skipping them here too
// keeps the preview honest (no arrow shown for a move that won't apply).
function planMoves(plotBlocks, activityId, targetDate, lockedIds = new Set()) {
  const moves = {};
  if (!targetDate) return moves;
  const movable = (block) => !lockedIds.has(block.activity_id);

  if (!activityId) {
    const anchor = plotBlocks.map((b) => effectiveDate(b)).filter(Boolean).sort()[0];
    const delta = anchor ? diffDays(anchor, targetDate) : 0;
    if (!delta) return moves;
    for (const block of plotBlocks) {
      if (!movable(block)) continue;
      const eff = effectiveDate(block);
      if (eff) moves[block.activity_id] = addDays(eff, delta);
    }
    return moves;
  }

  if (lockedIds.has(activityId)) return moves;

  const ordered = orderedByDate(plotBlocks);
  const idx = ordered.findIndex((b) => b.activity_id === activityId);
  if (idx === -1) return moves;
  const floor = idx > 0 ? effectiveDate(ordered[idx - 1]) : null;
  const clamped = floor && targetDate < floor ? floor : targetDate;
  const current = effectiveDate(ordered[idx]);
  const delta = current ? diffDays(current, clamped) : 0;
  if (!delta) return moves;

  moves[activityId] = clamped;
  for (let j = idx + 1; j < ordered.length; j++) {
    if (!movable(ordered[j])) continue;
    const eff = effectiveDate(ordered[j]);
    if (eff) moves[ordered[j].activity_id] = addDays(eff, delta);
  }
  return moves;
}

// What a set of moves would do to the plan's late starts and idle days
// — measured against the real counts, not guessed.
function previewImpact(plotBlocks, moves, placementCounts, planStartDate, planEndDate) {
  const counts = { ...placementCounts };
  let lateNow = 0;
  let lateNext = 0;
  for (const block of plotBlocks) {
    const eff = effectiveDate(block);
    if (!eff) continue;
    const next = moves[block.activity_id] || eff;
    if (block.date && diffDays(block.date, eff) > 0) lateNow += 1;
    if (block.date && diffDays(block.date, next) > 0) lateNext += 1;
    if (next === eff) continue;
    counts[eff] = (counts[eff] || 0) - 1;
    if (counts[eff] <= 0) delete counts[eff];
    counts[next] = (counts[next] || 0) + 1;
  }
  const window = dateListBetween(planStartDate, planEndDate);
  return {
    late: lateNext - lateNow,
    idle: window.filter((d) => !counts[d]).length - window.filter((d) => !placementCounts[d]).length,
  };
}

const MINI_DOWS = ["S", "M", "T", "W", "T", "F", "S"];

// A plot row: the date chip, and - when open - the mini month picker
// plus the chain of activities that moves with it.
function PlotRow({
  plot,
  firstName,
  editable,
  editing,
  hoverDate,
  monthOffset,
  target,
  placementCounts,
  planStartDate,
  planEndDate,
  isAdmin,
  holidayMap,
  onToggleEdit,
  onHoverDate,
  onPrevMonth,
  onNextMonth,
  onSelectTarget,
  onApplyMoves,
  onPieceAction,
  onReset,
  onDone,
}) {
  const posthog = usePostHog();
  const { plotId, blocks, acres, variety, said, want, shift } = plot;
  const moved = shift !== 0;
  const mag = Math.abs(shift);
  const lockedIds = new Set(blocks.filter((b) => b.completed && !isAdmin).map((b) => b.activity_id));
  // Calendar dates (past, current, or future) are editable by both admins
  // and regional managers alike — only mukkadam allocation is admin-gated
  // for past dates (see PlanningActivityRow). Kept as its own variable
  // (rather than using `editable` directly below) so a future role-based
  // exception here stays a one-line change.
  const rowEditable = editable;
  // Which date the picker is editing: a single activity, or the whole
  // plot's chain when nothing specific is selected.
  const targetIndex = target ? blocks.findIndex((b) => b.activity_id === target) : -1;
  const targetBlock = targetIndex >= 0 ? blocks[targetIndex] : null;
  const targetName = targetBlock?.activity_name || "this activity";
  const targetLocked = Boolean(targetBlock && lockedIds.has(targetBlock.activity_id));
  const focusDate = targetBlock ? effectiveDate(targetBlock) : want;
  const focusSaid = targetBlock ? targetBlock.date : said;
  const floorDate = targetIndex > 0 ? effectiveDate(blocks[targetIndex - 1]) : null;

  // The piece actually being edited when a single activity is targeted —
  // its own current date/percent, so a partial move can be offered.
  const activePiece = targetBlock
    ? targetBlock.pieces.find((p) => p.date === focusDate) || targetBlock.pieces.find((p) => !p.date) || targetBlock.pieces[0]
    : null;
  const percentOptions = activePiece ? [25, 50, 75, 100].filter((p) => p <= activePiece.percent) : [100];
  const [movePercent, setMovePercent] = useState(100);
  useEffect(() => {
    setMovePercent(100);
  }, [target]);

  const hovering = Boolean(editing && hoverDate && focusDate && hoverDate !== focusDate);
  const previewMoves = hovering ? planMoves(blocks, target, hoverDate, lockedIds) : {};
  const month = editing ? buildWindowMonth(planStartDate, planEndDate, focusDate, monthOffset) : null;
  const impact = hovering ? previewImpact(blocks, previewMoves, placementCounts, planStartDate, planEndDate) : null;
  const startISO = planStartDate ? toISODate(planStartDate) : null;
  const endISO = planEndDate ? toISODate(planEndDate) : null;
  const isIdle = (date) => !placementCounts[date] && (!startISO || date >= startISO) && (!endISO || date <= endISO);

  function commitDay(date) {
    const holidayLabel = holidayMap[date];
    if (holidayLabel) {
      const proceed = window.confirm(`${date} is a holiday (${holidayLabel}). Place it here anyway?`);
      if (!proceed) return;
    }
    track(posthog, "plot_date_committed", {
      plot_id: plotId,
      partial_move: Boolean(target && activePiece && movePercent < activePiece.percent),
      is_holiday: Boolean(holidayLabel),
    });
    if (target && activePiece && movePercent < activePiece.percent) {
      onPieceAction(target, activePiece.piece_id, movePercent, date);
    } else {
      onApplyMoves(planMoves(blocks, target, date, lockedIds), date);
    }
  }

  let impactText;
  if (impact) {
    const parts = [];
    if (impact.late !== 0)
      parts.push(`${impact.late > 0 ? "+" : ""}${impact.late} late start${Math.abs(impact.late) === 1 ? "" : "s"}`);
    if (impact.idle !== 0)
      parts.push(`${impact.idle > 0 ? "+" : ""}${impact.idle} idle day${Math.abs(impact.idle) === 1 ? "" : "s"}`);
    impactText = parts.length ? parts.join(" · ") : "No change to late starts or idle days";
  } else if (target) {
    impactText = floorDate
      ? `${targetName} can't start before ${formatPlanDate(floorDate)} — later activities move with it`
      : `${targetName} — later activities move with it`;
  } else if (moved) {
    impactText = `You are asking ${firstName} to move ${mag} day${mag === 1 ? "" : "s"} ${shift < 0 ? "earlier" : "later"}`;
  } else {
    impactText = `${firstName} already gave this date`;
  }
  const impactTone = impact
    ? impact.late > 0 || impact.idle > 0
      ? "is-bad"
      : impact.late < 0 || impact.idle < 0
        ? "is-good"
        : ""
    : "";

  return (
    <div className="plot-row-wrap">
      <div
        className={`call-plot plot-row ${editing ? "plot-row--editing" : ""} ${rowEditable ? "plot-row--clickable" : ""}`}
        role={rowEditable ? "button" : undefined}
        tabIndex={rowEditable ? 0 : undefined}
        aria-expanded={rowEditable ? editing : undefined}
        onClick={rowEditable ? onToggleEdit : undefined}
        onKeyDown={
          rowEditable
            ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onToggleEdit();
              }
            }
            : undefined
        }
      >
        <span className="call-plot__mark" style={moved ? { background: "var(--color-warning)" } : undefined} />
        <span>
          <strong className="plot-row__id">{plotId}</strong>
          <small>
            {acres.toFixed(2)} acre
            {variety ? ` · ${variety}` : ""}
          </small>
        </span>
        <span className="plot-row__said">
          <span className={moved ? "plot-row__struck" : ""}>
            {moved ? `said ${formatPlanDate(said)}` : "their own date"}
          </span>
          {moved && (
            <em className={mag >= 14 ? "is-strong" : ""}>
              {mag} day{mag === 1 ? "" : "s"} {shift < 0 ? "earlier" : "later"}
            </em>
          )}
        </span>
        <span
          className={`plot-chip ${editing ? "plot-chip--open" : ""} ${rowEditable ? "" : "plot-chip--static"}`}
          aria-hidden="true"
        >
          <span>{formatPlanDate(want)}</span>
          <i>&#9662;</i>
        </span>
      </div>

      {editing && month && (
        <div className="plot-edit-row">
          <div>
            <div className="mini-month-head">
              <button type="button" onClick={onPrevMonth} disabled={month.index === 0}>
                &#8249;
              </button>
              <strong>{month.label}</strong>
              <button type="button" onClick={onNextMonth} disabled={month.index >= month.count - 1}>
                &#8250;
              </button>
            </div>
            <div className="mini-month-grid">
              {MINI_DOWS.map((d, i) => (
                <span key={`${d}-${i}`} className="mini-month-dow">
                  {d}
                </span>
              ))}
              {month.cells.map((cell, index) => {
                if (!cell) return <span key={`blank-${index}`} />;
                const blocked = Boolean(floorDate && cell.date < floorDate);
                const holidayLabel = holidayMap[cell.date];
                return (
                  <button
                    key={cell.date}
                    type="button"
                    disabled={blocked}
                    title={
                      blocked
                        ? `${targetName} can't start before ${formatPlanDate(floorDate)}`
                        : holidayLabel
                          ? `Holiday: ${holidayLabel}`
                          : cell.date === focusSaid
                            ? `The date ${firstName} gave you`
                            : isIdle(cell.date)
                              ? "Crew has nothing booked"
                              : ""
                    }
                    className={`mini-day ${cell.date === focusDate ? "mini-day--now" : ""} ${cell.date === focusSaid ? "mini-day--their" : ""
                      } ${isIdle(cell.date) ? "mini-day--idle" : ""} ${cell.date === hoverDate && !blocked ? "mini-day--hover" : ""
                      } ${blocked ? "mini-day--blocked" : ""} ${holidayLabel ? "mini-day--holiday" : ""}`}
                    onMouseEnter={() => !blocked && onHoverDate(cell.date)}
                    onMouseLeave={() => onHoverDate(null)}
                    onClick={() => !blocked && commitDay(cell.date)}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
            <div className="mini-legend">
              <span>
                <i className="mini-legend__now" />
                now
              </span>
              <span>
                <i className="mini-legend__their" />
                their date
              </span>
              <span>
                <i className="mini-legend__idle" />
                crew idle
              </span>
            </div>
          </div>

          <div className="moves-with-date">
            <div className="moves-with-date__title">
              {hovering
                ? `If you move it to ${formatPlanDate(hoverDate)}`
                : target
                  ? `Moving ${targetName} — pick a date`
                  : "Everything that moves with this date"}
            </div>
            <p className="moves-with-date__hint">
              {target
                ? "Tap the activity again to go back to moving the whole plot."
                : "Tap an activity to change just its date."}
            </p>

            {target && targetLocked && (
              <p className="muted" style={{ margin: "0 0 10px" }}>
                Already completed — can&apos;t be rescheduled.
              </p>
            )}
            {target && !targetLocked && activePiece && (
              <div className="piece-row" style={{ borderBottom: "none", padding: "0 0 10px" }}>
                <div className="piece-row__actions">
                  {targetBlock?.completed && isAdmin && (
                    <span className="status-pill status-pill--pending">Admin override</span>
                  )}
                  <span className="muted" style={{ fontSize: 12 }}>
                    Move
                  </span>
                  <select
                    className="input piece-row__select"
                    value={movePercent}
                    onChange={(event) => setMovePercent(Number(event.target.value))}
                    aria-label="Percent to move"
                  >
                    {percentOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}%
                      </option>
                    ))}
                  </select>
                  <span className="muted" style={{ fontSize: 12 }}>
                    of this activity — pick a day
                  </span>
                  {activePiece.date && (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => onPieceAction(target, activePiece.piece_id, movePercent, null)}
                    >
                      Unschedule {movePercent}%
                    </button>
                  )}
                </div>
              </div>
            )}

            {blocks.map((block, index) => {
              const eff = effectiveDate(block);
              const to = previewMoves[block.activity_id] || eff;
              const changed = to !== eff;
              const isTarget = block.activity_id === target;
              const rowLocked = lockedIds.has(block.activity_id);
              const rowFloor = index > 0 ? effectiveDate(blocks[index - 1]) : null;
              return (
                <button
                  type="button"
                  key={block.activity_id}
                  className={`move-line move-line--pick ${isTarget ? "move-line--target" : ""} ${rowLocked ? "move-line--locked" : ""
                    }`}
                  disabled={rowLocked}
                  onClick={() => !rowLocked && onSelectTarget(isTarget ? null : block.activity_id)}
                  title={
                    rowLocked
                      ? "Already completed — can't be rescheduled."
                      : rowFloor
                        ? `Can't start before ${formatPlanDate(rowFloor)} (${blocks[index - 1].activity_name || "previous activity"})`
                        : "Pick a date for this activity"
                  }
                >
                  <span className="move-line__mark" />
                  <span className="move-line__name">{block.activity_name || "Unnamed activity"}</span>
                  {block.completed && (
                    <span className="status-pill status-pill--pending" style={{ marginRight: 4 }}>
                      {isAdmin ? "Admin override" : "Completed"}
                    </span>
                  )}
                  {changed && <del className="move-line__from">{formatPlanDate(eff)}</del>}
                  {changed && <span className="move-line__arrow">&#8594;</span>}
                  <strong className="move-line__to">{formatPlanDate(to)}</strong>
                </button>
              );
            })}
            <div className={`move-impact ${impactTone}`}>{impactText}</div>
            <div className="plot-edit-actions">
              <button type="button" className="plot-edit-actions__primary" onClick={onDone}>
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  track(posthog, "plot_reset_to_original_clicked", { plot_id: plotId });
                  onReset();
                }}
              >
                {moved ? `Back to ${formatPlanDate(said)}` : "Their date"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlanningWorkbench({
  visibleBlocks,
  farmerGroups,
  lateStartsTop,
  lateStartsTotal,
  idleRanges,
  totalIdleDays,
  defaultPlacementCounts,
  referenceMaxCount,
  planStartDate,
  planEndDate,
  placementCounts,
  placementsByDate,
  selectedDate,
  isAdmin,
  holidayMap,
  onSelectDay,
  onMoveBlockToDate,
  onApplyMoves,
  onPieceAction,
  onResetPlot,
  onUnscheduleAll,
  deployedMukkadams,
  onAllocateMukkadam,
  onUnassignMukkadam,
  dayAllocations,
  dayAllocationsLoading,
  hasUnsavedChanges,
}) {
  const posthog = usePostHog();
  const [planMode, setPlanMode] = useState("new");
  const [activitySearch, setActivitySearch] = useState("");

  useDebouncedTrack(posthog, "planner_activity_search_applied", activitySearch);
  const [editingPlot, setEditingPlot] = useState(null);
  const [hoverDate, setHoverDate] = useState(null);
  const [editMonth, setEditMonth] = useState(0);
  const [editTarget, setEditTarget] = useState(null);
  const [expandedFarmers, setExpandedFarmers] = useState(() => new Set());
  const isNewPlan = planMode === "new";
  const calendarCounts = isNewPlan ? placementCounts : defaultPlacementCounts;
  const selectedEntries = isNewPlan ? placementsByDate[selectedDate] || [] : [];
  const selectedCount = isNewPlan ? selectedEntries.length : calendarCounts[selectedDate] || 0;
  const capacityTarget = Math.max(1, referenceMaxCount || selectedCount || 1);
  const selectedLoadPct = Math.min(100, Math.round((selectedCount / capacityTarget) * 100));

  const searchTerm = activitySearch.trim().toLowerCase();
  const searchedFarmerGroups = useMemo(() => {
    if (!searchTerm) return farmerGroups;
    return farmerGroups
      .map((farmer) => {
        const farmerText = `${farmer.name} ${farmer.key}`.toLowerCase();
        const blocks = farmer.blocks.filter((block) => {
          const blockText = [
            farmerText,
            block.activity_name,
            block.farmer_name,
            block.plot_id,
            block.activity_id,
            block.date,
            effectiveDate(block),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return blockText.includes(searchTerm);
        });
        return blocks.length ? { ...farmer, blocks } : null;
      })
      .filter(Boolean);
  }, [farmerGroups, searchTerm]);

  return (
    <section className="planning-workbench">
      <div className="planner-tabs" aria-label="Planning options">
        <div className="planner-tabs__label">Plan</div>
        <button
          type="button"
          className={`planner-tab ${!isNewPlan ? "planner-tab--active" : ""}`}
          onClick={() => {
            track(posthog, "plan_mode_switched", { mode: "default" });
            setPlanMode("default");
          }}
        >
          <span>Default</span>
          <small>Existing calendar</small>
        </button>
        <button
          type="button"
          className={`planner-tab ${isNewPlan ? "planner-tab--active" : ""}`}
          onClick={() => {
            track(posthog, "plan_mode_switched", { mode: "new" });
            setPlanMode("new");
          }}
        >
          <span>New</span>
          <small>Create new dates</small>
        </button>
        <div className="planner-nudge">
          <span>
            <strong>{isNewPlan ? "New plan" : "Default calendar"}</strong>
            {isNewPlan ? "Change dates with the farmer dropdowns." : "Showing the existing schedule from the API."}
          </span>
        </div>
      </div>

      <div className="planner-grid">
        <aside className={`calls-panel ${!isNewPlan ? "calls-panel--readonly" : ""}`}>
          <div className="calls-panel__header">
            <div>
              <strong>{isNewPlan ? "Calls to make" : "Existing work"}</strong>
              <span>
                {isNewPlan
                  ? "Ordered by what the call is worth. One message covers all a farmer's plots."
                  : "Read-only view of the current backend calendar."}
              </span>
            </div>
            <div >
              <label className="activity-search">
                <span>Search activities</span>
                <input
                  type="search"
                  value={activitySearch}
                  onChange={(event) => setActivitySearch(event.target.value)}
                  placeholder="Activity, plot, farmer"
                />
              </label>

            </div>
          </div>
          {isNewPlan && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "2px" }}>
              <button
                type="button"
                className="btn"
                onClick={onUnscheduleAll}
              >
                Unschedule all
              </button>
            </div>
          )}
          <div className="calls-list">
            {searchedFarmerGroups.length === 0 && (
              <p className="muted panel-empty">
                {searchTerm ? "No activities match this search." : "No farmers have plots in this plan."}
              </p>
            )}
            {searchedFarmerGroups.map((farmer) => {
              const plots = groupPlotsForFarmer(farmer.blocks);
              const movedPlots = plots.filter((entry) => entry.shift !== 0);
              const maxShift = movedPlots.reduce((max, entry) => Math.max(max, Math.abs(entry.shift)), 0);
              const isExpanded = expandedFarmers.has(farmer.key);
              const visiblePlots = searchTerm || isExpanded ? plots : plots.slice(0, 8);
              const extraCount = plots.length - visiblePlots.length;

              return (
                <article className="call-card" key={farmer.key}>
                  <div className="call-card__top">
                    <div>
                      <strong>{farmer.name}</strong>
                      <span>
                        {plots.length} plot{plots.length === 1 ? "" : "s"}
                        {movedPlots.length > 0
                          ? ` · ${movedPlots.length} date${movedPlots.length === 1 ? "" : "s"} to move · up to ${maxShift}d`
                          : ""}
                        {farmer.vaultOverdue ? " · vault overdue" : ""}
                      </span>
                    </div>
                  </div>

                  {visiblePlots.map((plot) => {
                    const rowKey = `${farmer.key}::${plot.plotId}`;
                    const isEditing = editingPlot === rowKey;
                    return (
                      <PlotRow
                        key={rowKey}
                        plot={plot}
                        firstName={(farmer.name || "").split(" ")[0] || "they"}
                        editable={isNewPlan}
                        editing={isEditing}
                        hoverDate={isEditing ? hoverDate : null}
                        monthOffset={isEditing ? editMonth : 0}
                        target={isEditing ? editTarget : null}
                        placementCounts={placementCounts}
                        planStartDate={planStartDate}
                        planEndDate={planEndDate}
                        isAdmin={isAdmin}
                        holidayMap={holidayMap}
                        onToggleEdit={() => {
                          setEditingPlot(isEditing ? null : rowKey);
                          setEditMonth(0);
                          setHoverDate(null);
                          setEditTarget(null);
                        }}
                        onHoverDate={setHoverDate}
                        onPrevMonth={() => setEditMonth((m) => m - 1)}
                        onNextMonth={() => setEditMonth((m) => m + 1)}
                        onSelectTarget={(activityId) => {
                          setEditTarget(activityId);
                          setEditMonth(0);
                          setHoverDate(null);
                        }}
                        onApplyMoves={(moves, date) => {
                          onApplyMoves(moves, date);
                          setHoverDate(null);
                        }}
                        onPieceAction={(activityId, pieceId, percent, date) => {
                          onPieceAction(activityId, pieceId, percent, date);
                          setHoverDate(null);
                        }}
                        onReset={() => {
                          onResetPlot(plot.blocks);
                          setEditingPlot(null);
                          setHoverDate(null);
                          setEditTarget(null);
                        }}
                        onDone={() => {
                          setEditingPlot(null);
                          setHoverDate(null);
                          setEditTarget(null);
                        }}
                      />
                    );
                  })}
                  {!searchTerm && plots.length > 8 && (
                    <button
                      type="button"
                      className="show-more-plots"
                      aria-expanded={isExpanded}
                      onClick={() => {
                        setExpandedFarmers((current) => {
                          const next = new Set(current);
                          if (next.has(farmer.key)) next.delete(farmer.key);
                          else next.add(farmer.key);
                          return next;
                        });
                      }}
                    >
                      {isExpanded
                        ? "Show fewer plots"
                        : `+${extraCount} more plot${extraCount === 1 ? "" : "s"}`}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </aside>

        <main className="planner-center">
          <div className="planner-panel">
            <div className="planner-panel__header planner-panel__header--row">
              <div>
                <strong>Crew calendar</strong>
                <span className="muted">Click a day to see what&apos;s placed on it.</span>
              </div>
              <div className="planner-legend">
                <span>
                  <i className="legend-line legend-line--crew" />
                  Crew booked
                </span>
                <span>
                  <i className="legend-line legend-line--partial" />
                  Part booked
                </span>
                <span>
                  <i className="legend-line legend-line--late" />
                  Peak day
                </span>
                <span>
                  <i className="legend-line legend-line--idle" />
                  Idle
                </span>
              </div>
            </div>
            <PlaygroundCalendar
              placementCounts={calendarCounts}
              maxCount={referenceMaxCount}
              activeDate={selectedDate}
              onSelectDay={onSelectDay}
              hint={isNewPlan ? "Pick a farmer's plot dropdown, or click a day to inspect it." : "Default mode shows the existing calendar from the API. Switch to New to change dates."}
              startDate={planStartDate}
              endDate={planEndDate}
              holidayMap={holidayMap}
            />
          </div>

          <div className="planner-lower-grid">
            <div className="planner-panel day-plan-panel">
              <div className="day-plan-panel__head">
                <div>
                  <strong>{formatPlanDate(selectedDate)}</strong>
                  <span className="muted">
                    {selectedCount} of {capacityTarget} activity slots used
                  </span>
                </div>
                <span>{Math.max(capacityTarget - selectedCount, 0)} free</span>
              </div>
              <div className="capacity-bar">
                <span style={{ width: `${selectedLoadPct}%` }} />
              </div>
              {!isNewPlan && selectedCount > 0 ? (
                <p className="muted">The default calendar has {selectedCount} activities on this day.</p>
              ) : selectedEntries.length > 0 ? (
                selectedEntries.map((block) => (
                  <PlanningActivityRow
                    key={block.activity_id}
                    block={block}
                    date={effectiveDate(block)}
                    note={diffDays(block.date, effectiveDate(block)) > 0 ? "pushed later" : undefined}
                    deployedMukkadams={deployedMukkadams}
                    onAllocateMukkadam={onAllocateMukkadam}
                    onUnassignMukkadam={onUnassignMukkadam}
                    dayAllocations={dayAllocations}
                    dayAllocationsLoading={dayAllocationsLoading}
                    isAdmin={isAdmin}
                    disabledReason={
                      hasUnsavedChanges
                        ? "Save your plan before allocating mukkadams — this piece isn't scheduled on the backend yet."
                        : undefined
                    }
                  />
                ))
              ) : (
                <p className="muted">No work is placed on this day yet.</p>
              )}
            </div>

            <aside className="planner-side">
              <section className="planner-panel">
                <div className="planner-panel__header">
                  <strong>
                    Late starts <span>{lateStartsTotal} job{lateStartsTotal === 1 ? "" : "s"}</span>
                  </strong>
                  <span className="muted">Started later than their real scheduled date. Worst 6 shown.</span>
                </div>
                {lateStartsTop.length ? (
                  lateStartsTop.map(({ block, daysLate }) => (
                    <button
                      key={block.activity_id}
                      type="button"
                      className="risk-row risk-row--late"
                      onClick={() => {
                        track(posthog, "late_start_row_clicked", { activity_id: block.activity_id, days_late: daysLate });
                        onSelectDay(effectiveDate(block));
                      }}
                    >
                      <span />
                      <strong>{block.activity_name || "Unnamed activity"}</strong>
                      <small>
                        Plot {block.plot_id || "-"} · {block.farmer_name}
                      </small>
                      <em>{daysLate}d late</em>
                    </button>
                  ))
                ) : (
                  <p className="muted panel-empty">No late starts in this plan.</p>
                )}
              </section>

              <section className="planner-panel">
                <div className="planner-panel__header">
                  <strong>Idle windows</strong>
                  <span className="muted">
                    {referenceMaxCount > 0
                      ? `${totalIdleDays * referenceMaxCount} person-days unsold across ${idleRanges.length} window${idleRanges.length === 1 ? "" : "s"}.`
                      : `${totalIdleDays} empty day${totalIdleDays === 1 ? "" : "s"} across ${idleRanges.length} window${idleRanges.length === 1 ? "" : "s"}.`}
                  </span>
                </div>
                {idleRanges.length ? (
                  idleRanges.map((range) => {
                    const days = diffDays(range.start, range.end) + 1;
                    return (
                      <button
                        key={range.start}
                        type="button"
                        className="idle-row"
                        onClick={() => {
                          track(posthog, "idle_window_row_clicked", { start: range.start, days });
                          onSelectDay(range.start);
                        }}
                      >
                        <strong>{days > 1 ? `${formatPlanDate(range.start)} – ${formatPlanDate(range.end)}` : formatPlanDate(range.start)}</strong>
                        <span>
                          {days} day{days === 1 ? "" : "s"}
                          {referenceMaxCount > 0 ? ` · ${days * referenceMaxCount} pd` : ""}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="muted panel-empty">No idle windows in this plan.</p>
                )}
              </section>
            </aside>
          </div>
        </main>
      </div>
    </section>
  );
}

export default function ClusterPlaygroundPageV2() {
  const posthog = usePostHog();
  const { id } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [cluster, setCluster] = useState(null);
  const [referenceCalendar, setReferenceCalendar] = useState(null);
  const [planStartDate, setPlanStartDate] = useState(null);
  const [planEndDate, setPlanEndDate] = useState(null);
  const [error, setError] = useState(null);

  const [plan, dispatch] = useReducer(planReducer, {});
  const [selectedDay, setSelectedDay] = useState(null);

  const [scheduleInfo, setScheduleInfo] = useState(undefined);
  const [vaultByFarmer, setVaultByFarmer] = useState({});
  const [holidays, setHolidays] = useState(null);
  const [deployedMukkadams, setDeployedMukkadams] = useState([]);
  // Read-side of mukkadam allocation: who's already assigned on the
  // currently-selected day, keyed by activity_id — sourced from the
  // calendar-day endpoint (the only place allocations are readable) so a
  // reopened row shows the real, persisted state rather than a per-session
  // guess. `day` guards against showing stale data for a different day
  // while the next fetch is still in flight.
  const [dayAllocations, setDayAllocations] = useState({ day: null, byActivity: {} });
  const [dayAllocationsLoading, setDayAllocationsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [featureUnavailable, setFeatureUnavailable] = useState(false);

  useEffect(() => {
    setCluster(null);
    setReferenceCalendar(null);
    setPlanStartDate(null);
    setPlanEndDate(null);
    setScheduleInfo(undefined);
    setHolidays(null);
    setHasUnsavedChanges(false);
    setFeatureUnavailable(false);
    setSelectedDay(null);

    trackGroup(posthog, "cluster", id, {});
    api.getCluster(id).then(setCluster).catch((e) => setError(e.message));
    api.getCalendar(id).then(setReferenceCalendar).catch((e) => setError(e.message));
    api.getClusterHolidays(id).then(setHolidays).catch((e) => setError(e.message));
    // Supplementary picker data for mukkadam allocation — swallow errors
    // (including the documented 502 "tender unreachable" shape) rather
    // than routing through setError, since it's not core page function.
    api.getDeployedMukkadams()
      .then((r) => setDeployedMukkadams(r.results || []))
      .catch(() => setDeployedMukkadams([]));

    Promise.all([
      api.getClusterPlayground(id),
      api.getClusterSchedule(id).catch((e) => (e.status === 404 ? { schedule: null } : Promise.reject(e))),
      api.getClusterVault(id).catch((e) => (e.status === 404 ? { farmers: [] } : Promise.reject(e))),
    ])
      .then(([playgroundData, scheduleData, vaultData]) => {
        const schedule = scheduleData.schedule || null;
        setScheduleInfo(schedule);
        setVaultByFarmer(Object.fromEntries((vaultData.farmers || []).map((f) => [f.farmer_id, f])));
        dispatch({
          type: "INIT",
          blocks: playgroundData.blocks,
          savedPieces: indexSavedPieces(schedule?.data),
        });

        const { start, end } = planWindow();
        setPlanStartDate(start);
        setPlanEndDate(end);
      })
      .catch((e) => {
        if (e.status === 404) {
          setFeatureUnavailable(true);
          setScheduleInfo(null);
          return;
        }
        setError(e.message);
      });
  }, [id]);

  const blocksArray = useMemo(() => Object.values(plan), [plan]);

  const visibleBlocks = blocksArray;

  const placementCounts = useMemo(() => {
    const counts = {};
    for (const b of visibleBlocks) {
      const eff = effectiveDate(b);
      if (eff) counts[eff] = (counts[eff] || 0) + 1;
    }
    return counts;
  }, [visibleBlocks]);

  const placementsByDate = useMemo(() => {
    const map = {};
    for (const b of visibleBlocks) {
      const eff = effectiveDate(b);
      if (!eff) continue;
      if (!map[eff]) map[eff] = [];
      map[eff].push(b);
    }
    return map;
  }, [visibleBlocks]);

  const referenceMaxCount = useMemo(() => {
    const counts = (referenceCalendar?.days || []).map((d) => d.activity_count || 0);
    return counts.length ? Math.max(...counts) : 0;
  }, [referenceCalendar]);

  const defaultPlacementCounts = useMemo(() => {
    const counts = {};
    for (const day of referenceCalendar?.days || []) {
      const date = day.date || day.day || day.activity_date;
      const count = day.activity_count ?? day.count ?? day.activities_count ?? 0;
      if (date) counts[date] = Number(count) || 0;
    }
    return counts;
  }, [referenceCalendar]);

  const holidayMap = useMemo(
    () => holidayDateMap([...(holidays?.global || []), ...(holidays?.cluster || [])]),
    [holidays]
  );

  function blockStatus(block) {
    const pieces = block.pieces || [];
    const hasUnscheduled = pieces.some((p) => !p.date);
    const hasScheduled = pieces.some((p) => p.date);
    if (!hasUnscheduled) return "full";
    if (!hasScheduled) return "none";
    return "partial";
  }

  const totalBlocks = blocksArray.length;
  const computedActivePlots = new Set(blocksArray.map((b) => b.plot_id).filter(Boolean)).size;
  const activePlots = cluster?.active_plots ?? computedActivePlots;
  const completed = blocksArray.filter((b) => b.completed).length;
  const partiallyScheduled = blocksArray.filter((b) => blockStatus(b) === "partial").length;
  const notStarted = blocksArray.filter((b) => blockStatus(b) === "none").length;

  // ---- Farmer call cards, grouped by farmer then by plot -------------
  const allFarmerGroups = useMemo(() => {
    const groups = new Map();
    for (const block of visibleBlocks) {
      const key = farmerKeyOf(block);
      if (!groups.has(key)) {
        groups.set(key, { key, name: block.farmer_name || "Unknown farmer", blocks: [], acres: 0, worth: 0 });
      }
      groups.get(key).blocks.push(block);
    }

    return [...groups.values()]
      .map((group) => {
        let acres = 0;
        let worth = 0;
        let datesToMove = 0;
        let maxDaysToMove = 0;
        let laterCount = 0;
        let earlierCount = 0;
        for (const block of group.blocks) {
          acres += Number(block.acres || 0);
          worth += Number(block.total_price || 0);
          const eff = effectiveDate(block);
          if (block.date && eff && eff !== block.date) {
            datesToMove += 1;
            const d = diffDays(block.date, eff);
            maxDaysToMove = Math.max(maxDaysToMove, Math.abs(d));
            if (d > 0) laterCount += 1;
            else earlierCount += 1;
          }
        }
        const vault = vaultByFarmer[group.blocks[0]?.farmer_id];
        return {
          ...group,
          acres,
          worth,
          datesToMove,
          maxDaysToMove,
          laterCount,
          earlierCount,
          vaultOverdue: Boolean(vault?.is_overdue),
        };
      })
      .sort((a, b) => b.laterCount - a.laterCount || b.datesToMove - a.datesToMove || b.worth - a.worth);
  }, [visibleBlocks, vaultByFarmer]);

  const farmerGroups = useMemo(() => allFarmerGroups.slice(0, 8), [allFarmerGroups]);

  const lateStartsAll = useMemo(
    () =>
      visibleBlocks
        .map((block) => ({ block, daysLate: diffDays(block.date, effectiveDate(block)) }))
        .filter((item) => item.daysLate > 0)
        .sort((a, b) => b.daysLate - a.daysLate),
    [visibleBlocks]
  );
  const lateStartsTop = useMemo(() => lateStartsAll.slice(0, 6), [lateStartsAll]);

  const idleDaysList = useMemo(
    () => dateListBetween(planStartDate, planEndDate).filter((d) => !placementCounts[d]),
    [planStartDate, planEndDate, placementCounts]
  );
  const idleRanges = useMemo(() => groupIdleRanges(idleDaysList).slice(0, 6), [idleDaysList]);

  const selectedDate =
    selectedDay ||
    Object.keys(placementCounts).sort((a, b) => (placementCounts[b] || 0) - (placementCounts[a] || 0))[0] ||
    new Date().toISOString().slice(0, 10);

  function handleSelectDay(date) {
    setSelectedDay(date);
  }

  // Reads current mukkadam allocations for the selected day off the
  // calendar-day endpoint, so the "who's already on this piece" chips
  // reflect the real backend state (including allocations made by anyone
  // else), not just what this browser tab added. Re-run after every
  // allocate/unassign so the chips stay in sync with what actually saved.
  async function loadDayAllocations(day) {
    if (!day) return;
    setDayAllocationsLoading(true);
    try {
      const dayData = await api.getCalendarDay(id, day);
      const byActivity = {};
      for (const entry of dayData || []) {
        if (entry.activity_id != null) byActivity[entry.activity_id] = entry.mukkadams || [];
      }
      setDayAllocations({ day, byActivity });
    } catch (e) {
      setDayAllocations({ day, byActivity: {} });
    } finally {
      setDayAllocationsLoading(false);
    }
  }

  useEffect(() => {
    loadDayAllocations(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, selectedDate]);

  function handleMoveBlockToDate(activityId, targetDate) {
    const block = plan[activityId];
    if (!block || (block.completed && !isAdmin)) return;
    for (const piece of block.pieces || []) {
      dispatch({ type: "SPLIT", activityId, pieceId: piece.piece_id, movePercent: piece.percent, targetDate, allowCompleted: isAdmin });
    }
    setHasUnsavedChanges(true);
    setSelectedDay(targetDate);
  }

  // Commits a moves map from planMoves() — { activity_id: newDate }.
  function handleApplyMoves(moves, focusDate) {
    const entries = Object.entries(moves || {});
    if (!entries.length) return;
    for (const [activityId, date] of entries) {
      for (const piece of plan[activityId]?.pieces || []) {
        dispatch({ type: "SPLIT", activityId, pieceId: piece.piece_id, movePercent: piece.percent, targetDate: date, allowCompleted: isAdmin });
      }
    }
    setHasUnsavedChanges(true);
    if (focusDate) setSelectedDay(focusDate);
  }

  // A single piece, moved (or unscheduled, when targetDate is null) at
  // exactly the percent requested — the partial-move / unschedule path,
  // as opposed to handleApplyMoves' whole-chain cascade.
  function handlePieceAction(activityId, pieceId, percent, targetDate) {
    const block = plan[activityId];
    if (!block) return;
    dispatch({ type: "SPLIT", activityId, pieceId, movePercent: percent, targetDate, allowCompleted: isAdmin });
    setHasUnsavedChanges(true);
    if (targetDate) setSelectedDay(targetDate);
  }

  function handleResetPlot(plotBlocks) {
    for (const block of plotBlocks) {
      if (!block.date) continue;
      for (const piece of plan[block.activity_id]?.pieces || []) {
        dispatch({ type: "SPLIT", activityId: block.activity_id, pieceId: piece.piece_id, movePercent: piece.percent, targetDate: block.date, allowCompleted: isAdmin });
      }
    }
    setHasUnsavedChanges(true);
  }

  // Clears every non-completed activity back to unscheduled, so the plan
  // can be laid out from scratch. Completed activities are never
  // touched, admin or not.
  function handleUnscheduleAll() {
    const eligible = blocksArray.filter((b) => !b.completed && b.pieces.some((p) => p.date));
    if (eligible.length === 0) return;
    const ok = window.confirm(
      `Unschedule all ${eligible.length} non-completed ${eligible.length === 1 ? "activity" : "activities"}? This clears their placed dates so you can plan the calendar from scratch. Completed activities are never touched.`
    );
    if (!ok) return;
    track(posthog, "unschedule_all_clicked", { cluster_id: id, activity_count: eligible.length });
    dispatch({ type: "UNSCHEDULE_ALL" });
    setHasUnsavedChanges(true);
  }

  // Every block is included, always — including fully-unscheduled ones
  // with date: null — so an explicit unschedule actually persists
  // instead of silently reverting to the activity's original date_time
  // on the next load.
  async function handleSavePlan() {
    const payload = blocksArray.map((b) => ({
      activity_id: b.activity_id,
      pieces: b.pieces.map((p) => ({ percent: p.percent, date: p.date || null })),
    }));

    setSaving(true);
    setSaveError(null);
    try {
      const saved = await api.saveClusterSchedule(id, payload);
      track(posthog, "save_plan_clicked", { cluster_id: id, activity_count: payload.length });
      setScheduleInfo(saved);
      setHasUnsavedChanges(false);
      api.getCalendar(id).then(setReferenceCalendar).catch((e) => setError(e.message));
    } catch (e) {
      trackException(posthog, e);
      track(posthog, "save_plan_failed", { cluster_id: id });
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // Allocates a mukkadam to one date-piece of an activity. Orthogonal to
  // the plan/schedule state — it never touches `plan`, `hasUnsavedChanges`,
  // save, or publish, and its result is only used by the calling row to
  // show a chip / cap its own remaining percent for this session.
  async function handleAllocateMukkadam(activityId, pieceDate, mukkadam, percent) {
    try {
      const allocation = await api.allocateMukkadam(id, {
        activity_id: activityId,
        piece_date: pieceDate,
        mukkadam_id: mukkadam.mukkadam_id,
        mukkadam_name: mukkadam.mukkadam_name,
        percent,
      });
      await loadDayAllocations(pieceDate);
      return { ok: true, allocation };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // Soft-removes an allocation (backend deactivates it, never deletes it)
  // and refreshes the day's allocations so the chip disappears immediately.
  async function handleUnassignMukkadam(pieceDate, allocationId) {
    try {
      await api.unassignMukkadam(id, allocationId);
      await loadDayAllocations(pieceDate);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      const published = await api.publishClusterSchedule(id);
      track(posthog, "publish_calendar_clicked", { cluster_id: id, actor_role: user?.role });
      setScheduleInfo(published);
    } catch (e) {
      trackException(posthog, e);
      track(posthog, "publish_calendar_failed", { cluster_id: id });
      setPublishError(e.message);
    } finally {
      setPublishing(false);
    }
  }

  if (error) {
    return (
      <div className="page">
        <ErrorState title="Could not load planning playground" message={error} />
      </div>
    );
  }
  if (!cluster) {
    return (
      <div className="page">
        <LoadingState title="Loading planning playground" rows={5} />
      </div>
    );
  }
  if (featureUnavailable) {
    return (
      <div className="page">
        <Link to={`/clusters/${id}`} className="btn" style={{ marginBottom: 8, display: "inline-block" }}>
          ← Back to {cluster.name}
        </Link>
        <h1>Planning playground</h1>
        <EmptyState
          title="Planning unavailable"
          message="The production backend does not expose the planning endpoint for this cluster yet."
        />
      </div>
    );
  }

  const scheduleStatusText = scheduleInfo
    ? `Loaded the saved plan — last edited by ${scheduleInfo.updated_by_name || "someone"} on ${scheduleInfo.updated_at?.slice(0, 10)}.`
    : "Nothing saved yet — plan freely, then save when ready.";

  // last_published_* (not published_at) is the field pair the real
  // publish endpoint actually returns on its response.
  const publishedStatusText = scheduleInfo?.last_published_at
    ? `Published to the calendar by ${scheduleInfo.last_published_by_name || "someone"} on ${scheduleInfo.last_published_at.slice(0, 10)}.`
    : "Not published yet.";

  // Read straight off the last publish response — a plain save doesn't
  // touch this field, so it naturally disappears once `scheduleInfo` is
  // replaced by a save that didn't also publish.
  const mukkadamPushResult = scheduleInfo?.mukkadam_allocations_push || null;

  const publishDisabledReason = !scheduleInfo
    ? "Save a plan before publishing"
    : hasUnsavedChanges
      ? "Save your latest changes before publishing"
      : undefined;

  return (
    <div className="page planning-page">
      <section className="planning-summary-shell">
        <div className="page-header planning-summary-header">
          <div>
            <Link to={`/clusters/${id}`} className="btn" style={{ marginBottom: 8, display: "inline-flex" }}>
              &larr; Back to {cluster.name}
            </Link>
            <h1>Planning playground</h1>
            <div className="cluster-card__meta">{scheduleStatusText}</div>
            {scheduleInfo?.edits?.length > 0 && (
              <>
                <button
                  className="btn"
                  type="button"
                  style={{ marginTop: 6 }}
                  onClick={() => {
                    track(posthog, "edit_history_toggled", { cluster_id: id, expanded: !showHistory });
                    setShowHistory((v) => !v);
                  }}
                >
                  {showHistory ? "Hide" : "Show"} edit history ({scheduleInfo.edits.length})
                </button>
                {showHistory && (
                  <div style={{ marginTop: 8 }}>
                    {scheduleInfo.edits.map((e) => (
                      <div key={e.id} className="muted" style={{ padding: "3px 0" }}>
                        {e.edited_by_name || "Unknown"} — {e.edited_at?.slice(0, 16).replace("T", " ")}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="cluster-card__meta">{publishedStatusText}</div>
            {saveError && <p className="error-text">{saveError}</p>}
            {publishError && <p className="error-text">{publishError}</p>}

            {mukkadamPushResult && (
              <div style={{ marginTop: 8 }}>
                <span className={`status-pill ${mukkadamPushStatusClass(mukkadamPushResult.status)}`}>
                  Mukkadam push: {mukkadamPushResult.status || "UNKNOWN"}
                </span>
                <span className="muted" style={{ marginLeft: 8, fontSize: 13 }}>
                  {mukkadamPushResult.submitted ?? 0} submitted &middot; {mukkadamPushResult.created ?? 0} created &middot;{" "}
                  {mukkadamPushResult.updated ?? 0} updated
                  {mukkadamPushResult.errors ? ` · ${mukkadamPushResult.errors} failed` : ""}
                </span>
                {(mukkadamPushResult.results || []).length > 0 && (
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {mukkadamPushResult.results.map((r, i) => (
                      <li
                        key={`${r.api_activity_id}-${r.mukkadam_id}-${i}`}
                        className={r.status === "error" ? "error-text" : "muted"}
                        style={{ fontSize: 13 }}
                      >
                        {mukkadamPushRowLabel(r)}: {mukkadamPushRowMessage(r)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="planning-header-right">
            <div className="page-actions">
              <button className="btn btn-primary" type="button" onClick={handleSavePlan} disabled={saving}>
                {saving ? "Saving..." : "Save plan"}
              </button>
              <button
                className="btn"
                type="button"
                onClick={handlePublish}
                disabled={!scheduleInfo || hasUnsavedChanges || publishing}
                title={publishDisabledReason}
              >
                {publishing ? "Publishing..." : "Publish calendar"}
              </button>
            </div>
          </div>
        </div>

        <div className="stat-row planning-stat-row">
          <div className="stat-box">
            <div className="stat-box__value">{totalBlocks}</div>
            <div className="stat-box__label">Total blocks</div>
          </div>
          <div className="stat-box">
            <div className="stat-box__value">{activePlots}</div>
            <div className="stat-box__label">Active plots</div>
          </div>
          <div className="stat-box">
            <div className="stat-box__value">{completed}</div>
            <div className="stat-box__label">Completed</div>
          </div>
          <div className="stat-box">
            <div className="stat-box__value">{partiallyScheduled}</div>
            <div className="stat-box__label">Partially scheduled</div>
          </div>
          <div className="stat-box">
            <div className="stat-box__value">{notStarted}</div>
            <div className="stat-box__label">Not started</div>
          </div>
          <FillRateDetail calendar={referenceCalendar} />
        </div>
      </section>

      <PlanningWorkbench
        visibleBlocks={visibleBlocks}
        farmerGroups={farmerGroups}
        lateStartsTop={lateStartsTop}
        lateStartsTotal={lateStartsAll.length}
        idleRanges={idleRanges}
        totalIdleDays={idleDaysList.length}
        defaultPlacementCounts={defaultPlacementCounts}
        referenceMaxCount={referenceMaxCount}
        planStartDate={planStartDate}
        planEndDate={planEndDate}
        placementCounts={placementCounts}
        placementsByDate={placementsByDate}
        selectedDate={selectedDate}
        isAdmin={isAdmin}
        holidayMap={holidayMap}
        onSelectDay={handleSelectDay}
        onMoveBlockToDate={handleMoveBlockToDate}
        onApplyMoves={handleApplyMoves}
        onPieceAction={handlePieceAction}
        onResetPlot={handleResetPlot}
        onUnscheduleAll={handleUnscheduleAll}
        deployedMukkadams={deployedMukkadams}
        onAllocateMukkadam={handleAllocateMukkadam}
        onUnassignMukkadam={handleUnassignMukkadam}
        dayAllocations={dayAllocations}
        dayAllocationsLoading={dayAllocationsLoading}
        hasUnsavedChanges={hasUnsavedChanges}
      />
    </div>
  );
}
