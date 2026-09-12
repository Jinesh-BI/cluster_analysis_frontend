// src/components/PlaygroundCalendar.jsx
//
// A plain calendar — no fixed 6-month window. It runs from 10 days
// before the cluster's first currently-scheduled activity through 10
// days after its last (see planStartDate/planEndDate in
// ClusterPlaygroundPage), so an empty cluster doesn't drag along months
// of nothing to look at, and a busy one gets a little breathing room on
// both ends for reference.
//
// Cell color is scaled against `maxCount`, the SAME peak-day count the
// reference heatmap uses — not this calendar's own busiest day. That's
// what makes the color meaningful: pile everything from a red reference
// day onto one plan day and it goes red here too; spread it out and it
// goes green, on the same scale, so the improvement is actually visible.

import { colorForIntensity, textColorForIntensity } from "../utils/heatColor";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Matches .plan-cell's fixed 26px height in styles.css — unlike
// CalendarHeatmap, this grid isn't sized via a cellSize prop.
const PLAN_CELL_SIZE = 26;

function DayOfWeekLabels() {
  return (
    <div className="month-grid__day-labels">
      {DAY_LABELS.map((label) => (
        <div key={label} className="month-grid__day-label" style={{ height: PLAN_CELL_SIZE }}>
          {label}
        </div>
      ))}
    </div>
  );
}

function daysInMonthGrid(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ date: iso, dayOfWeek: dateObj.getDay(), day: d });
  }
  return cells;
}

function toWeekColumns(cells) {
  if (!cells.length) return [];
  const grid = [];
  for (let i = 0; i < cells[0].dayOfWeek; i++) grid.push({ blank: true });
  cells.forEach((cell) => grid.push(cell));
  while (grid.length % 7 !== 0) grid.push({ blank: true });
  return grid;
}

// Renders full months from `startDate` (or today, if that's not given)
// through the month containing `endDate`, trimming the leading edge of
// the FIRST month to startDate and the trailing edge of the LAST month
// to endDate — so the calendar's actual visible range is exactly
// startDate..endDate, not padded out to full calendar months on either
// side. If neither is given, falls back to just the current month
// (never renders zero months).
function buildMonthRange(startDate, endDate) {
  const today = new Date();
  const anchorStart = startDate || today;
  const trimStart = Boolean(startDate);

  const rangeStartMonth = new Date(anchorStart.getFullYear(), anchorStart.getMonth(), 1);
  const trimEnd = Boolean(endDate) && endDate >= anchorStart;
  const rangeEndDate = trimEnd ? endDate : anchorStart;
  const endCursor = new Date(rangeEndDate.getFullYear(), rangeEndDate.getMonth(), 1);

  const months = [];
  let cursor = new Date(rangeStartMonth);
  while (cursor <= endCursor) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    let cells = daysInMonthGrid(year, month);
    if (trimStart && year === startDate.getFullYear() && month === startDate.getMonth()) {
      cells = cells.filter((c) => c.day >= startDate.getDate());
    }
    if (trimEnd && year === rangeEndDate.getFullYear() && month === rangeEndDate.getMonth()) {
      cells = cells.filter((c) => c.day <= rangeEndDate.getDate());
    }
    months.push({
      key: `${year}-${month}`,
      label: `${MONTH_LABELS[month]} '${String(year).slice(2)}`,
      cells,
    });
    cursor = new Date(year, month + 1, 1);
  }
  return months;
}

// function MonthGrid({ month, placementCounts, maxCount, activeDate, onSelectDay }) {
//   const columns = toWeekColumns(month.cells);

//   return (
//     <div className="month-grid">
//       <div className="month-grid__weeks">
//         {columns.map((week, wi) => (
//           <div className="month-grid__week" key={wi}>
//             {week.map((cell, di) => {
//               if (!cell || cell.blank) return <div key={di} className="plan-cell plan-cell--blank" />;
//               const count = placementCounts[cell.date] || 0;
//               const intensity = maxCount > 0 ? Math.min(count / maxCount, 1) : 0;
//               const isActive = cell.date === activeDate;
//               return (
//                 <div
//                   key={di}
//                   className={`plan-cell${isActive ? " plan-cell--selected" : ""}`}
//                   style={{ background: colorForIntensity(intensity) }}
//                   title={`${cell.date}${count ? ` — ${count} placed` : ""}`}
//                   onClick={() => onSelectDay(cell.date)}
//                 >
//                   <span className="plan-cell__day" style={{ color: textColorForIntensity(intensity) }}>
//                     {cell.day}
//                   </span>
//                   {count > 0 && <span className="plan-cell__count">{count}</span>}
//                 </div>
//               );
//             })}
//           </div>
//         ))}
//       </div>
//       <div className="month-grid__label">{month.label}</div>
//     </div>
//   );
// }

// export default function PlaygroundCalendar({ placementCounts, maxCount, activeDate, onSelectDay, hint, startDate, endDate }) {
//   const months = buildMonthRange(startDate, endDate);

//   return (
//     <div className="plan-calendar">
//       <div className="calendar-with-day-labels">
//         <DayOfWeekLabels />
//         <div className="calendar-months">
//           {months.map((m) => (
//             <MonthGrid
//               key={m.key}
//               month={m}
//               placementCounts={placementCounts}
//               maxCount={maxCount}
//               activeDate={activeDate}
//               onSelectDay={onSelectDay}
//             />
//           ))}
//         </div>
//       </div>
//       <p className="muted" style={{ marginTop: 10 }}>{hint}</p>
//     </div>
//   );
// }

function MonthGrid({ month, placementCounts, maxCount, activeDate, onSelectDay }) {
  const cells = toWeekColumns(month.cells);

  return (
    <div className="month-grid">
      <div className="month-grid__label">{month.label}</div>
      <div className="month-grid__calendar">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <span key={`${day}-${index}`} className="month-grid__dow">{day}</span>
        ))}
        {cells.map((cell, index) => {
          if (!cell || cell.blank) return <div key={`blank-${index}`} className="plan-cell plan-cell--blank" />;
          const count = placementCounts[cell.date] || 0;
          const intensity = maxCount > 0 ? Math.min(count / maxCount, 1) : 0;
          const isActive = cell.date === activeDate;
          const loadClass =
            count === 0
              ? ""
              : intensity >= 0.75
                ? " plan-cell--late"
                : intensity >= 0.45
                  ? " plan-cell--partial"
                  : " plan-cell--booked";
          return (
            <div
              key={cell.date}
              className={`plan-cell${loadClass}${isActive ? " plan-cell--selected" : ""}`}
              title={`${cell.date}${count ? ` — ${count} placed` : ""}`}
              onClick={() => onSelectDay(cell.date)}
            >
              <span className="plan-cell__day">{cell.day}</span>
              {count > 0 && <span className="plan-cell__bar" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PlaygroundCalendar({ placementCounts, maxCount, activeDate, onSelectDay, hint, startDate, endDate }) {
  const months = buildMonthRange(startDate, endDate);

  return (
    <div className="plan-calendar">
      <div className="calendar-months">
        {months.map((m) => (
          <MonthGrid
            key={m.key}
            month={m}
            placementCounts={placementCounts}
            maxCount={maxCount}
            activeDate={activeDate}
            onSelectDay={onSelectDay}
          />
        ))}
      </div>
      <p className="muted" style={{ marginTop: 10 }}>{hint}</p>
    </div>
  );
}
