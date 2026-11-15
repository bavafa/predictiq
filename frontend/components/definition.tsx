"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";

/**
 * An ⓘ button that shows a plain definition in a small floating note (it does not move the page).
 * Hover shows it for as long as the pointer is over the button or the note. Click, Enter or Space pins it open,
 * and the same key or click closes it. Escape closes it. Keyboard focus alone does not open it.
 */
export function Definition({ text, name }: { text: string; name: string }) {
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const open = pinned || hover;
  const id = useId();
  const note = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  // Keep the note inside the window: slide it left when it would run past the right edge.
  useLayoutEffect(() => {
    if (!open || !note.current) return;
    const el = note.current;
    el.style.transform = "";
    const over = el.getBoundingClientRect().right - (document.documentElement.clientWidth - 8);
    setShift(over > 0 ? over : 0);
  }, [open]);

  const close = () => {
    setPinned(false);
    setHover(false);
  };
  return (
    <span className="relative inline-flex align-top" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`What "${name}" means`}
        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center text-base"
        onClick={() => (pinned ? close() : setPinned(true))}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
      >
        <span aria-hidden="true">ⓘ</span>
      </button>
      {open && (
        <span
          ref={note}
          id={id}
          role="note"
          style={shift ? { transform: `translateX(-${Math.ceil(shift)}px)` } : undefined}
          className="absolute top-full left-0 z-20 w-64 max-w-[calc(100vw-1rem)] rounded-md border border-input-edge bg-subtle px-2 py-1 text-xs leading-4 font-normal shadow-sm"
        >
          {text}
        </span>
      )}
    </span>
  );
}
