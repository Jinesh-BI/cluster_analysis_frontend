// src/components/BlockList.jsx
//
// Every activity in the cluster, shown as a "block" card you can click
// to open its detail panel. Laid out as a grid (see .block-list in
// styles.css) so short cards don't waste a full row each. Grouping is
// just for browsing — it doesn't change what a block IS, only how it's
// sorted into sections here.

import { useMemo, useState } from "react";

const GROUP_OPTIONS = [
  { key: "plot", label: "By plot" },
  { key: "farmer", label: "By farmer" },
  { key: "activity", label: "By activity" },
];

function groupKey(block, groupBy) {
  if (groupBy === "plot") return block.plot_id ? `Plot ${block.plot_id}` : "No plot on file";
  if (groupBy === "farmer") return block.farmer_name || block.farmer_id;
  return block.activity_name || "Unnamed activity";
}

// A block's pieces always add up to 100%. The part that matters for
// display is how much of that 100% still has no date.
function unscheduledPercent(block) {
  return block.pieces.filter((p) => !p.date).reduce((sum, p) => sum + p.percent, 0);
}

// No pill for "fully scheduled" — every block gets there eventually, so
// showing it on every card was noise, not information. Only the states
// that need attention get a pill: nothing placed yet, or partially placed.
function statusFor(block) {
  const unscheduled = unscheduledPercent(block);
  if (unscheduled <= 0) return null;
  if (unscheduled >= 100) return { label: "Not scheduled", cls: "status-pill--booked" };
  return { label: `${unscheduled}% left to place`, cls: "status-pill--partial" };
}

// Distinct colors per scheduled piece so a split block reads at a
// glance — unscheduled portions are always the same neutral gray
// regardless of position, since that's a distinct state, not "another
// piece." Hovering a segment shows its date via the native title
// tooltip — no custom popover needed.
const PIECE_COLORS = ["#2f6b4f", "#4a7fa3", "#c98a3f", "#8f6b9e", "#b5502f"];
const UNSCHEDULED_COLOR = "#c7cbc4";

function SplitBar({ pieces }) {
  let colorIdx = 0;
  return (
    <div className="split-bar">
      {pieces.map((p) => {
        const color = p.date ? PIECE_COLORS[colorIdx++ % PIECE_COLORS.length] : UNSCHEDULED_COLOR;
        return (
          <div
            key={p.piece_id}
            className="split-bar__segment"
            style={{ width: `${p.percent}%`, background: color }}
            title={`${p.percent}% — ${p.date || "Unscheduled"}`}
          />
        );
      })}
    </div>
  );
}

export default function BlockList({ blocks, activeBlockId, onSelectBlock, activePlotIds }) {
  const [groupBy, setGroupBy] = useState("plot");
  const [query, setQuery] = useState("");
  const [onlyUnscheduled, setOnlyUnscheduled] = useState(false);

  const activePlotIdSet = useMemo(() => new Set((activePlotIds || []).map(String)), [activePlotIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return blocks.filter((b) => {
      if (onlyUnscheduled && unscheduledPercent(b) <= 0) return false;
      if (!q) return true;
      return (
        (b.farmer_name || "").toLowerCase().includes(q) ||
        String(b.plot_id || "").toLowerCase().includes(q) ||
        (b.activity_name || "").toLowerCase().includes(q)
      );
    });
  }, [blocks, query, onlyUnscheduled]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const b of filtered) {
      const key = groupKey(b, groupBy);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(b);
    }
    const entries = [...map.entries()];
    if (groupBy === "plot") {
      // Plots with work already started/completed (active_plot_ids,
      // same concept as the "Active plots" KPI) surface first, so a
      // manager scanning the list sees live plots before untouched
      // ones. Alphabetical within each tier, same as before.
      entries.sort((a, z) => {
        const aActive = a[1].some((b) => activePlotIdSet.has(String(b.plot_id)));
        const zActive = z[1].some((b) => activePlotIdSet.has(String(b.plot_id)));
        if (aActive !== zActive) return aActive ? -1 : 1;
        return a[0].localeCompare(z[0]);
      });
    } else {
      entries.sort((a, z) => a[0].localeCompare(z[0]));
    }
    return entries;
  }, [filtered, groupBy, activePlotIdSet]);

  return (
    <div>
      <div className="block-filters">
        <input
          className="input"
          placeholder="Search farmer, plot, activity…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 240 }}
        />
        <div className="group-toggle">
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`btn ${groupBy === opt.key ? "btn-primary" : ""}`}
              onClick={() => setGroupBy(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <label className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={onlyUnscheduled}
            onChange={(e) => setOnlyUnscheduled(e.target.checked)}
          />
          Only show what still needs a day
        </label>
      </div>

      {groups.length === 0 && <p className="muted">No matching activities.</p>}

      {groups.map(([groupName, groupBlocks]) => {
        const isActivePlotGroup = groupBy === "plot" && groupBlocks.some((b) => activePlotIdSet.has(String(b.plot_id)));
        return (
          <div className="block-group" key={groupName}>
            <div className="block-group__title">
              {groupName} <span className="muted">({groupBlocks.length})</span>
              {isActivePlotGroup && (
                <span className="status-pill status-pill--paid" style={{ marginLeft: 8 }}>
                  Active
                </span>
              )}
            </div>
            <div className="block-list">
              {groupBlocks.map((b) => {
                const status = statusFor(b);
                const isUnscheduled = !b.completed && unscheduledPercent(b) >= 100;
                return (
                  <button
                    key={b.activity_id}
                    className={`block-item ${b.completed ? "block-item--completed " : ""}${
                      isUnscheduled ? "block-item--unscheduled " : ""
                    }${activeBlockId === b.activity_id ? "block-item--active" : ""}`}
                    onClick={() => onSelectBlock(b.activity_id)}
                  >
                    <span className="block-item__name">{b.activity_name || "Unnamed activity"}</span>
                    <span className="muted">
                      {b.farmer_name} • Plot {b.plot_id || "—"} • {b.acres} ac
                    </span>
                    {b.pieces.length > 1 && <SplitBar pieces={b.pieces} />}
                    {b.completed ? (
                      <span className="status-pill status-pill--paid">✓ Completed</span>
                    ) : (
                      status && <span className={`status-pill ${status.cls}`}>{status.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}