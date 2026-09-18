// src/components/Tooltip.jsx
//
// Reusable hover/focus tooltip. Portaled to document.body and positioned
// from the trigger's live bounding rect (position: fixed), not CSS
// position:absolute nested inside the trigger — so it's never clipped by
// a scrollable ancestor with overflow (e.g. MukkadamCard's .ledger-scroll)
// and always renders above everything else regardless of stacking context.
//
// Usage: <Tooltip content="…">{trigger}</Tooltip> — wraps children in an
// `as` element (default "span"; pass as="div" to preserve a grid/flex
// layout on the trigger itself, since Tooltip's wrapper becomes that
// element rather than an extra nested one).
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const GAP = 8;

export default function Tooltip({ content, children, placement = "top", as: Component = "span", className }) {
  const triggerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState(null);

  useLayoutEffect(() => {
    if (!visible) return;
    const update = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: placement === "bottom" ? rect.bottom + GAP : rect.top - GAP,
        left: rect.left + rect.width / 2,
      });
    };
    update();
    // Keeps the tooltip anchored while the trigger scrolls under it —
    // capture:true so scroll on any ancestor (not just window) is caught.
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [visible, placement]);

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  return (
    <Component ref={triggerRef} className={className} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {visible &&
        content &&
        coords &&
        createPortal(
          <span
            role="tooltip"
            className={`app-tooltip app-tooltip--${placement}`}
            style={{ top: coords.top, left: coords.left }}
          >
            {content}
          </span>,
          document.body,
        )}
    </Component>
  );
}
