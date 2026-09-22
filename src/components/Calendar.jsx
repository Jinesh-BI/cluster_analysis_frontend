// src/components/Calendar.jsx
//
// One calendar component for the whole app. Always opens centered on
// today, with Prev/Next to browse any month in either direction.
//
// Data-agnostic: the caller supplies getDayData(dateStr) returning
// { count, intensity, allCompleted, isHoliday, holidayLabel, inSpread,
// activityNames } (or nothing for an empty day) — every field is
// optional, callers only fill in what they have.
//
// Every cell is clickable, including empty ones — read-only calendars
// just show "no activities" for those; the plan calendar needs empty
// days clickable so you can place new work on them.

import { useState } from "react";
import { HEAT_SCALE, colorForIntensity, textColorForIntensity, colorForActivityName } from "../utils/heatColor";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function isoDate(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function todayIso() {
  const t = new Date();
  return isoDate(t.getFullYear(), t.getMonth(), t.getDate());
}

function daysInMonthGrid(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    cells.push({ date: isoDate(year, month, d), dayOfWeek: dateObj.getDay(), day: d });
  }
  return cells;
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

function MonthGrid({ year, month, cellSize, getDayData, activeDate, onSelectDay }) {
  const columns = toWeekColumns(daysInMonthGrid(year, month));
  const sizeStyle = { width: cellSize, height: cellSize };
  const today = todayIso();
  const dotSize = Math.max(2, Math.round(cellSize * 0.14));

  return (
    <div className="month-grid">
      <div className="month-grid__weeks">
        {columns.map((week, wi) => (
          <div className="month-grid__week" key={wi}>
            {week.map((cell, di) => {
              if (!cell || cell.blank) {
                return <div key={di} className="month-grid__cell month-grid__cell--blank" style={sizeStyle} />;
              }
              const data = getDayData ? getDayData(cell.date) : null;
              const count = data?.count ?? 0;
              const allCompleted = Boolean(data?.allCompleted);
              const isHoliday = Boolean(data?.isHoliday);
              const inSpread = Boolean(data?.inSpread);
              const activityNames = (data?.activityNames || []).slice(0, 3);
              const isActive = cell.date === activeDate;
              const isToday = cell.date === today;
              const cls = [
                "month-grid__cell",
                allCompleted && "month-grid__cell--completed",
                isHoliday && "month-grid__cell--holiday",
                inSpread && "month-grid__cell--spread",
                isActive && "month-grid__cell--active",
                isToday && "month-grid__cell--today",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <div
                  key={di}
                  className={cls}
                  style={{
                    ...sizeStyle,
                    background: isHoliday ? "#2b2b2b" : allCompleted ? undefined : colorForIntensity(data?.intensity ?? 0),
                    boxShadow: inSpread ? "inset 0 0 0 3px #e6007a" : undefined,
                  }}
                  title={
                    isHoliday
                      ? `${cell.date} — Holiday${data.holidayLabel ? `: ${data.holidayLabel}` : ""}`
                      : allCompleted
                      ? `${cell.date} - all ${count} ${count === 1 ? "activity" : "activities"} completed`
                      : `${cell.date}${count ? ` — ${count} ${count === 1 ? "activity" : "activities"}` : ""}${
                          data?.activityNames?.length ? `: ${data.activityNames.join(", ")}` : ""
                        }`
                  }
                  onClick={() => onSelectDay(cell.date)}
                >
                  {allCompleted && !isHoliday ? (
                    <span style={{ fontSize: Math.max(8, Math.round(cellSize * 0.6)) }}>✓</span>
                  ) : (
                    <span
                      className="month-grid__cell-day"
                      style={{ color: isHoliday ? "#e8e8e8" : textColorForIntensity(data?.intensity ?? 0) }}
                    >
                      {cell.day}
                    </span>
                  )}
                  {!allCompleted && !isHoliday && count > 0 && <span className="month-grid__cell-count">{count}</span>}
                  {activityNames.length > 0 && !allCompleted && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: 2,
                        left: 0,
                        right: 0,
                        display: "flex",
                        justifyContent: "center",
                        gap: 1,
                      }}
                    >
                      {activityNames.map((name) => (
                        <span
                          key={name}
                          style={{ width: dotSize, height: dotSize, borderRadius: "50%", background: colorForActivityName(name) }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="month-grid__label">
        {MONTH_LABELS[month]} &apos;{String(year).slice(2)}
      </div>
    </div>
  );
}

export default function Calendar({
  cellSize = 26,
  visibleMonths = 3,
  getDayData,
  activeDate,
  onSelectDay,
  legend = true,
}) {
  const [anchor, setAnchor] = useState(() => {
    const today = new Date();
    const centered = new Date(today.getFullYear(), today.getMonth() - Math.floor(visibleMonths / 2), 1);
    return { year: centered.getFullYear(), month: centered.getMonth() };
  });

  const months = [];
  for (let i = 0; i < visibleMonths; i++) {
    const d = new Date(anchor.year, anchor.month + i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  function shift(delta) {
    setAnchor((a) => {
      const d = new Date(a.year, a.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  const first = months[0];
  const last = months[months.length - 1];
  const rangeLabel =
    months.length > 1
      ? `${MONTH_LABELS[first.month]} '${String(first.year).slice(2)} – ${MONTH_LABELS[last.month]} '${String(last.year).slice(2)}`
      : `${MONTH_LABELS[first.month]} '${String(first.year).slice(2)}`;

  return (
    <div className="calendar">
      <div className="calendar__nav">
        <button className="btn" onClick={() => shift(-1)}>
          ‹ Prev
        </button>
        <button className="btn" onClick={() => shift(1)}>
          Next ›
        </button>
        <span className="calendar__range-label">{rangeLabel}</span>
      </div>
      <div className="calendar-with-day-labels">
        <DayOfWeekLabels cellSize={cellSize} />
        <div className="calendar-months">
          {months.map((m) => (
            <MonthGrid
              key={`${m.year}-${m.month}`}
              year={m.year}
              month={m.month}
              cellSize={cellSize}
              getDayData={getDayData}
              activeDate={activeDate}
              onSelectDay={onSelectDay}
            />
          ))}
        </div>
      </div>
      {legend && (
        <div className="heatmap-legend">
          <span>Less</span>
          {HEAT_SCALE.map((c) => (
            <span key={c} className="heatmap-swatch" style={{ background: c }} />
          ))}
          <span>More</span>
        </div>
      )}
    </div>
  );
}