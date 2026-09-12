// src/components/CalendarHeatmap.jsx
import { HEAT_SCALE, colorForIntensity } from "../utils/heatColor";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function DayOfWeekLabels({ cellSize }) {
  return (
    <div className="month-grid__day-labels">
      {DAY_LABELS.map((label) => (
        <div key={label} className="month-grid__day-label" style={{ height: cellSize }}>
          {label}
        </div>
      ))}
    </div>
  );
}

// Turns the backend's flat day list into one bucket per calendar month,
// each holding every day of that month (1st -> last), not just the days
// the cluster has data for -- days outside the cluster's tracked window
// just render as empty, same as a real zero-activity day.
function groupByMonth(days) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const first = new Date(`${days[0].date}T00:00:00`);
  const last = new Date(`${days[days.length - 1].date}T00:00:00`);
  const multiYear = first.getFullYear() !== last.getFullYear();

  const months = [];
  let cursor = new Date(first.getFullYear(), first.getMonth(), 1);
  const end = new Date(last.getFullYear(), last.getMonth(), 1);

  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ date: iso, dayOfWeek: dateObj.getDay(), data: byDate.get(iso) || null });
    }

    months.push({
      key: `${year}-${month}`,
      label: multiYear ? `${MONTH_LABELS[month]} '${String(year).slice(2)}` : MONTH_LABELS[month],
      cells,
    });
    cursor = new Date(year, month + 1, 1);
  }
  return months;
}

// Splits a month's days into week columns (Sun-Sat rows), padding the
// first week with blanks so day 1 lands in its real weekday row.
function toWeekColumns(cells) {
  const columns = [];
  let column = new Array(7).fill(null);
  for (let i = 0; i < cells[0].dayOfWeek; i++) column[i] = { blank: true };

  cells.forEach((cell) => {
    column[cell.dayOfWeek] = cell;
    if (cell.dayOfWeek === 6) {
      columns.push(column);
      column = new Array(7).fill(null);
    }
  });
  if (column.some((c) => c !== null)) columns.push(column);
  return columns;
}

function MonthGrid({ month, onSelectDay, cellSize }) {
  const columns = toWeekColumns(month.cells);
  const sizeStyle = { width: cellSize, height: cellSize };

  return (
    <div className="month-grid">
      <div className="month-grid__weeks">
        {columns.map((week, wi) => (
          <div className="month-grid__week" key={wi}>
            {week.map((cell, di) => {
              if (!cell || cell.blank) {
                return <div key={di} className="month-grid__cell month-grid__cell--blank" style={sizeStyle} />;
              }
              const count = cell.data?.activity_count ?? 0;
              const allCompleted = cell.data?.all_completed;
              return (
                <div
                  key={di}
                  className={`month-grid__cell${allCompleted ? " month-grid__cell--completed" : ""}`}
                  style={{ ...sizeStyle, background: allCompleted ? undefined : colorForIntensity(cell.data?.intensity ?? 0) }}
                  title={
                    allCompleted
                      ? `${cell.date} - all ${count} ${count === 1 ? "activity" : "activities"} completed`
                      : `${cell.date} - ${count} ${count === 1 ? "activity" : "activities"}`
                  }
                  onClick={() => count > 0 && onSelectDay(cell.date)}
                >
                  {allCompleted && <span style={{ fontSize: Math.max(8, Math.round(cellSize * 0.6)) }}>✓</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="month-grid__label">{month.label}</div>
    </div>
  );
}

// cellSize is optional — omit it (as ClusterDetailPage does) and you get
// the original small heatmap dots. Pass a bigger number to size it up
// for contexts (like the playground) where it needs to read as a real
// calendar, not a dot grid.
export default function CalendarHeatmap({ days, onSelectDay, cellSize = 12 }) {
  if (!days.length) {
    return <p className="muted">No scheduled activity yet for this cluster.</p>;
  }

  const months = groupByMonth(days);

  return (
    <div>
      <div className="calendar-with-day-labels">
        <DayOfWeekLabels cellSize={cellSize} />
        <div className="calendar-months">
          {months.map((m) => (
            <MonthGrid key={m.key} month={m} onSelectDay={onSelectDay} cellSize={cellSize} />
          ))}
        </div>
      </div>
      <div className="heatmap-legend">
        <span>Less</span>
        {HEAT_SCALE.map((c) => (
          <span key={c} className="heatmap-swatch" style={{ background: c }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}