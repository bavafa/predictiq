import type { ReactNode } from "react";

// Honest empty state for pages whose content arrives in a later stage.
// It deliberately shows no numbers, charts or tables.
export function NotBuilt({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby="not-built-title"
      className="rounded-lg border border-dashed border-input-edge bg-card p-6 text-center sm:p-10"
    >
      <h2 id="not-built-title" className="m-0 text-lg leading-7 font-semibold">
        {title}
      </h2>
      <p className="mx-auto mt-2 mb-0 max-w-xl text-sm leading-5 text-ink-2">{children}</p>
    </section>
  );
}
