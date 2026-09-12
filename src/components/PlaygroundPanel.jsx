// src/components/PlaygroundPanel.jsx
//
// One panel, two possible contexts:
//   { type: "day", date }        -> what's placed on that day
//   { type: "block", activityId } -> that block's full list of pieces

import PieceRow from "./PieceRow";
import RatingsList from "./Ratings";
import PlotTimeline from "./PlotTimeline";
import { formatCurrency } from "../utils/format";
import { blockSummaryDate } from "../utils/dates";
import { isGapScheduleActivity } from "../utils/gapSchedule";

export default function PlaygroundPanel({
  context,
  block,
  dayEntries,
  vault,
  onArmMove,
  onUnschedule,
  onClose,
  isAdmin,
  onAutoAllocate,
  excludedSpreadPlotIds,
  onToggleSpreadPlot,
  allBlocks,
  deployedMukkadams,
  onAllocateMukkadam,
  onUnassignMukkadam,
}) {
  if (!context) return null;

  if (context.type === "day") {
    const distinctPlotIds = [...new Set(dayEntries.map(({ block: b }) => b.plot_id).filter((p) => p != null))];
    const includedPlotIds = distinctPlotIds.filter((pid) => !excludedSpreadPlotIds?.includes(pid));

    return (
      <div className="day-panel">
        <div className="day-panel__header">
          <strong>{context.date}</strong>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>

        {dayEntries.length === 0 && (
          <p className="muted">
            Nothing placed here yet. Open a block below, choose how much of it to move, then click this day.
          </p>
        )}

        {distinctPlotIds.length > 1 && (
          <div className="activity-item">
            <div className="muted" style={{ marginBottom: 6 }}>
              Show each plot's full spread on the calendar (which other days it's scheduled on):
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {distinctPlotIds.map((plotId) => {
                const sample = dayEntries.find(({ block: b }) => String(b.plot_id) === String(plotId))?.block;
                const cropVariety = sample?.crop ? `${sample.crop}${sample.variety ? ` (${sample.variety})` : ""}` : null;
                const acres = sample?.acres != null ? `${sample.acres} ac` : null;
                const label = [sample?.farmer_name, `Plot ${plotId}`, cropVariety, acres].filter(Boolean).join(" • ");
                return (
                  <label key={plotId} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={!excludedSpreadPlotIds?.includes(plotId)}
                      onChange={() => onToggleSpreadPlot(plotId)}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {allBlocks && includedPlotIds.length > 0 && (
          <div className="activity-item">
            {includedPlotIds.map((plotId) => {
              const plotBlocks = allBlocks.filter((b) => String(b.plot_id) === String(plotId));
              const meta = plotBlocks[0];
              return (
                <PlotTimeline
                  key={plotId}
                  plotId={plotId}
                  farmerName={meta?.farmer_name}
                  crop={meta?.crop}
                  variety={meta?.variety}
                  acres={meta?.acres}
                  entries={plotBlocks.flatMap((b) =>
                    b.pieces.map((p) => ({ activity_name: b.activity_name, date: p.date, completed: b.completed }))
                  )}
                />
              );
            })}
          </div>
        )}
        {dayEntries.map(({ block: b, piece }) => (
          <PieceRow
            key={piece.piece_id}
            block={b}
            piece={piece}
            showBlockName
            onArmMove={onArmMove}
            onUnschedule={onUnschedule}
            isAdmin={isAdmin}
            deployedMukkadams={deployedMukkadams}
            onAllocateMukkadam={onAllocateMukkadam}
            onUnassignMukkadam={onUnassignMukkadam}
          />
        ))}
      </div>
    );
  }

  // context.type === "block"
  if (!block) return null;

  return (
    <div className="day-panel">
      <div className="day-panel__header">
        <strong>
          {block.completed && (
            <span className="completed-check" title="Completed">
              ✓
            </span>
          )}
          {block.activity_name || "Unnamed activity"}
        </strong>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="activity-item">
        <div className="muted">
          {block.farmer_name} • Plot {block.plot_id || "—"}
          {block.crop ? ` • ${block.crop}` : ""}
          {block.variety ? ` (${block.variety})` : ""}
        </div>
        <div className="muted">
          {block.acres} ac total • {formatCurrency(block.total_price)}
        </div>
        {blockSummaryDate(block) && <div className="muted">{blockSummaryDate(block)}</div>}
      </div>

      {block.completed && block.ratings?.length > 0 && (
        <div className="activity-item">
          <div className="muted" style={{ marginBottom: 4 }}>Ratings</div>
          <RatingsList ratings={block.ratings} />
        </div>
      )}

      {vault && (
        <div className="activity-item">
          <div>
            <strong>Vault balance</strong>{" "}
            {vault.is_overdue && <span className="status-pill status-pill--pending">Overdue</span>}
          </div>
          <div className="muted">{formatCurrency(vault.balance)} available</div>
          {vault.balance >= block.total_price ? (
            <span className="status-pill status-pill--paid" style={{ marginTop: 6, display: "inline-block" }}>
              Covers this activity
            </span>
          ) : (
            <span className="status-pill status-pill--booked" style={{ marginTop: 6, display: "inline-block" }}>
              Short by {formatCurrency(block.total_price - vault.balance)}
            </span>
          )}
        </div>
      )}

      <div className="muted" style={{ margin: "14px 0 6px" }}>
        Where it's scheduled
      </div>
      {block.pieces.map((piece) => (
        <PieceRow
          key={piece.piece_id}
          block={block}
          piece={piece}
          onArmMove={onArmMove}
          onUnschedule={onUnschedule}
          isAdmin={isAdmin}
          deployedMukkadams={deployedMukkadams}
          onAllocateMukkadam={onAllocateMukkadam}
          onUnassignMukkadam={onUnassignMukkadam}
        />
      ))}

      {isGapScheduleActivity(block.activity_name) && block.pieces.some((p) => p.date) && (!block.completed || isAdmin) && (
        <div style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => onAutoAllocate(block)}>
            Auto-allocate rest of this plot
          </button>
          {block.completed && (
            <p className="muted" style={{ marginTop: 4 }}>
              Admin override — this activity is already completed.
            </p>
          )}
        </div>
      )}
    </div>
  );
}