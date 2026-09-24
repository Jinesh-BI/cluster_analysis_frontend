import { useEffect, useRef } from "react";
import { posthogEnabled } from "./posthog";

export function track(posthog, event, properties) {
  if (posthogEnabled) posthog?.capture(event, properties);
}

export function trackException(posthog, error) {
  if (posthogEnabled) posthog?.captureException(error);
}

export function trackGroup(posthog, type, key, properties) {
  if (posthogEnabled && key != null) posthog?.group(type, key, properties);
}

// Fires `event` once a free-text search input has held a non-empty value
// for `delay`ms — one event per settled query instead of one per keystroke.
// Never sends the raw query text (it's user-generated content, which may
// contain PII like a phone number someone searched for) — only its length.
export function useDebouncedTrack(posthog, event, value, properties, delay = 600) {
  const lastRef = useRef(null);
  useEffect(() => {
    if (!posthogEnabled) return undefined;
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (!trimmed) {
      lastRef.current = null;
      return undefined;
    }
    const timer = setTimeout(() => {
      if (lastRef.current === trimmed) return;
      lastRef.current = trimmed;
      posthog?.capture(event, { ...properties, query_length: trimmed.length });
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posthog, event, value, delay]);
}
