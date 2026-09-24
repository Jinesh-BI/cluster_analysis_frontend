// src/components/PieceRow.jsx
//
// A block's work is a list of "pieces" that always add up to 100%,
// e.g. [{percent: 60, date: "2026-09-12"}, {percent: 40, date: null}].
// This row shows ONE piece and lets you peel a percentage off it —
// either to move onto a different day, or to send back to unscheduled.
// This works the same whether the piece already has a date or not,
// which is what makes re-splitting already-scheduled work possible.
//
// It also shows who's allocated to work THIS piece — one or more
// mukkadams, each with a percent of their own (independent of the
// piece's own date-percent). Allocation only applies to a piece that
// already has a date; there's nothing to allocate labour against until
// the work is actually placed on a day.

import { useState } from "react";
import { usePostHog } from "@posthog/react";
import RatingsList from "./Ratings";
import { track } from "../analytics/track";

const PERCENT_OPTIONS = [25, 50, 75, 100];

export default function PieceRow({
  block,
  piece,
  showBlockName,
  onArmMove,
  onUnschedule,
  isAdmin,
  deployedMukkadams,
  onAllocateMukkadam,
  onUnassignMukkadam,
}) {
  const posthog = usePostHog();
  const options = PERCENT_OPTIONS.filter((p) => p <= piece.percent);
  const [percent, setPercent] = useState(options[options.length - 1] || 100);
  const locked = block.completed && !isAdmin;

  const allocations = (block.mukkadam_allocations || []).filter((a) => a.piece_date === piece.date);
  const allocatedPercent = allocations.reduce((sum, a) => sum + a.percent, 0);
  const remainingPercent = 100 - allocatedPercent;
  const percentOptions = PERCENT_OPTIONS.filter((p) => p <= remainingPercent);

  const alreadyAllocatedIds = new Set(allocations.map((a) => String(a.mukkadam_id)));
  const availableMukkadams = (deployedMukkadams || []).filter(
    (m) => !alreadyAllocatedIds.has(String(m.mukkadam_id))
  );

  const [showAddMukkadam, setShowAddMukkadam] = useState(false);
  const [pickedMukkadamId, setPickedMukkadamId] = useState("");
  const [pickedPercent, setPickedPercent] = useState(null);
  const [mukkadamError, setMukkadamError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    const mukkadam = availableMukkadams.find((m) => String(m.mukkadam_id) === pickedMukkadamId);
    const percentToAdd = pickedPercent || percentOptions[percentOptions.length - 1];
    if (!mukkadam || !percentToAdd) return;
    setSaving(true);
    setMukkadamError(null);
    const result = await onAllocateMukkadam(block.activity_id, piece.date, mukkadam, percentToAdd);
    setSaving(false);
    if (result?.ok) {
      track(posthog, "mukkadam_allocated_to_piece", {
        activity_id: block.activity_id,
        mukkadam_id: mukkadam.mukkadam_id,
        percent: percentToAdd,
      });
      setShowAddMukkadam(false);
      setPickedMukkadamId("");
      setPickedPercent(null);
    } else {
      setMukkadamError(result?.error || "Could not allocate this mukkadam.");
    }
  }

  async function handleRemove(allocationId) {
    setMukkadamError(null);
    const result = await onUnassignMukkadam(block.activity_id, allocationId);
    if (result?.ok) {
      track(posthog, "mukkadam_unassigned_from_piece", { activity_id: block.activity_id, allocation_id: allocationId });
    } else {
      setMukkadamError(result?.error || "Could not remove this allocation.");
    }
  }

  return (
    <div className="piece-row">
      <div className="piece-row__info">
        {showBlockName && (
          <div className="piece-row__name">
            {block.completed && (
              <span className="completed-check" title="Completed">
                ✓
              </span>
            )}
            {block.activity_name || "Unnamed activity"}
          </div>
        )}
        <div className="muted">
          {piece.date ? piece.date : "Unscheduled"} • {piece.percent}%
          {showBlockName
            ? ` • ${block.farmer_name} • Plot ${block.plot_id || "—"}${
                block.crop ? ` • ${block.crop}` : ""
              }${block.variety ? ` (${block.variety})` : ""} • ${block.acres} ac`
            : ""}
        </div>
        {showBlockName && block.completed && block.ratings?.length > 0 && (
          <RatingsList ratings={block.ratings} />
        )}
      </div>

      {locked ? (
        <p className="muted" style={{ margin: 0 }}>
          Already completed — can&apos;t be rescheduled.
        </p>
      ) : (
        <div className="piece-row__actions">
          {block.completed && isAdmin && (
            <span className="status-pill status-pill--pending" style={{ marginRight: 6 }}>
              Admin override
            </span>
          )}
          <select
            className="input piece-row__select"
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            aria-label="Percent to move"
          >
            {options.map((p) => (
              <option key={p} value={p}>
                {p}%
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={() => {
              track(posthog, "piece_move_armed", { activity_id: block.activity_id, piece_id: piece.piece_id, percent });
              onArmMove(block.activity_id, piece.piece_id, percent);
            }}
          >
            Move to a day
          </button>
          {piece.date && (
            <button
              className="btn"
              onClick={() => {
                track(posthog, "piece_unscheduled", { activity_id: block.activity_id, piece_id: piece.piece_id, percent });
                onUnschedule(block.activity_id, piece.piece_id, percent);
              }}
            >
              Unschedule
            </button>
          )}
        </div>
      )}

      {piece.date && onAllocateMukkadam && (
        <div className="mukkadam-section">
          {allocations.length > 0 && (
            <div className="mukkadam-chips">
              {allocations.map((a) => (
                <span className="mukkadam-chip" key={a.allocation_id}>
                  {a.mukkadam_name || a.mukkadam_id} • {a.percent}%
                  <button
                    type="button"
                    className="mukkadam-chip__remove"
                    onClick={() => handleRemove(a.allocation_id)}
                    title="Remove this mukkadam"
                    aria-label="Remove this mukkadam"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {remainingPercent <= 0 ? (
            <span className="muted">Fully allocated</span>
          ) : showAddMukkadam ? (
            <div className="mukkadam-add-row">
              <select
                className="input"
                value={pickedMukkadamId}
                onChange={(e) => setPickedMukkadamId(e.target.value)}
                aria-label="Choose mukkadam"
              >
                <option value="">Choose a mukkadam…</option>
                {availableMukkadams.map((m) => (
                  <option key={m.mukkadam_id} value={m.mukkadam_id}>
                    {m.mukkadam_name} • crew of {m.crew_size}
                  </option>
                ))}
              </select>
              <select
                className="input piece-row__select"
                value={pickedPercent || percentOptions[percentOptions.length - 1]}
                onChange={(e) => setPickedPercent(Number(e.target.value))}
                aria-label="Percent of this piece"
              >
                {percentOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}%
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={handleAdd} disabled={!pickedMukkadamId || saving}>
                {saving ? "Adding…" : "Add"}
              </button>
              <button className="btn" onClick={() => setShowAddMukkadam(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="btn" onClick={() => setShowAddMukkadam(true)}>
              + Add mukkadam
            </button>
          )}

          {mukkadamError && (
            <p className="error-text" style={{ margin: 0 }}>
              {mukkadamError}
            </p>
          )}
          <p className="muted" style={{ margin: 0, fontSize: 11 }}>
            Only works on a date that&apos;s already saved to your plan.
          </p>
        </div>
      )}
    </div>
  );
}