// src/hooks/useCountdown.js
//
// Live "time until" label for a maturity entry's matures_at timestamp —
// recomputes from wall-clock time rather than trusting the API's own
// seconds_until_mature (which goes stale the moment it's fetched).
// Ticks every 30s: earnings mature over hours, so second-level precision
// would just be wasted renders.
import { useEffect, useState } from "react";

function formatRemaining(ms) {
  if (ms <= 0) return "Matured";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function useCountdown(targetIso) {
  const [label, setLabel] = useState(() => (targetIso ? formatRemaining(new Date(targetIso) - Date.now()) : null));

  useEffect(() => {
    if (!targetIso) {
      setLabel(null);
      return;
    }
    const tick = () => setLabel(formatRemaining(new Date(targetIso) - Date.now()));
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [targetIso]);

  return label;
}
