"use client";

import { useId, useState } from "react";

/** An ⓘ button that opens a plain definition. Escape closes it. */
export function Definition({ text, name }: { text: string; name: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="inline-flex flex-col align-top">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`What "${name}" means`}
        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center text-base"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        <span aria-hidden="true">ⓘ</span>
      </button>
      {open && (
        <span id={id} role="note" className="mb-2 max-w-sm rounded-md border border-input-edge bg-subtle px-2 py-1 text-xs leading-4 font-normal">
          {text}
        </span>
      )}
    </span>
  );
}
