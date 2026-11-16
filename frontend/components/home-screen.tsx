"use client";

import Link from "next/link";

import { useData } from "@/components/data-provider";
import { AlertCard } from "@/components/overview-screen";
import { NoModelData, ServiceError, Skeleton } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { slotsUsed, useJobs } from "@/lib/jobs";
import { caughtFacts, parseResults } from "@/lib/model-performance";
import { parseHour, readableHour } from "@/lib/time";
import type { Fleet } from "@/lib/types";
import { carriedSearch } from "@/lib/url-state";
import { useApiQuery } from "@/lib/use-api-query";
import { cn } from "@/lib/utils";

const card = "rounded-lg border border-line bg-card p-4 sm:p-5";
const h2 = "m-0 text-xl leading-7 font-semibold";
const linkClass = "flex min-h-11 w-fit items-center text-[15px] font-semibold";

const STEPS = [
  ["Spot the risk", "Every hour each machine gets a status: Act today if it is likely to fail within 24 hours, otherwise Normal."],
  ["Check the evidence", "Open a machine to see which sensor or fault is behind the alert."],
  ["Plan the work", "Add jobs to the work plan. It puts the costliest risks first and fills the crew slots you have."],
] as const;

/** The v2 landing page (decision 83): what the product is, the plant at the simulated plant time, and where to go. */
export function HomeScreen() {
  const { client, meta, view, search } = useData();
  const ready = meta.status === "ready" ? meta.meta : null;
  const fleet = useApiQuery<Fleet>(
    (signal) => client.fleet({ at: view!.at, cutoff: view!.cutoff }, { signal }),
    [client, ready?.model_version, view?.at, view?.cutoff],
  );
  if (!ready || !view) return null;
  if (fleet.status === "error") {
    return fleet.error.kind === "no-model-data" ? (
      <NoModelData />
    ) : (
      <ServiceError what="the plant" error={fleet.error as ApiError} onRetry={fleet.retry} />
    );
  }
  if (fleet.status !== "ready") {
    return (
      <div className="flex flex-col gap-4" data-testid="home-loading">
        <Skeleton className="h-48 w-full" label="Loading the plant" />
        <Skeleton className="h-32 w-full" label="Loading the plant status" />
      </div>
    );
  }
  return <Body fleet={fleet.data} carried={carriedSearch(search)} crew={ready.planner_defaults.crew_slots} />;
}

function Body({ fleet, carried, crew }: { fleet: Fleet; carried: string; crew: number }) {
  const { client, meta } = useData();
  const { jobs, dismissed, status, add } = useJobs();
  const version = meta.status === "ready" ? meta.meta.model_version : "";
  const accuracy = useApiQuery(
    async (signal) => {
      const [m, t] = await Promise.all([client.modelMetrics({ signal }), client.thresholdAnalysis({ signal })]);
      return parseResults(m, t);
    },
    [client, version],
  );
  const facts = accuracy.status === "ready" && accuracy.data ? caughtFacts(accuracy.data) : null;

  const total = fleet.rows.length;
  const actToday = fleet.rows.filter((r) => r.status === "alert");
  const open = actToday.filter((r) => !dismissed.includes(r.machine_id));
  const top = open.slice(0, 3);
  const booked = slotsUsed(status);
  const h = parseHour(fleet.at.slice(0, 16));
  const plantTime = h === null ? fleet.at : readableHour(h);
  const n = actToday.length;

  return (
    <div className="flex max-w-[1120px] flex-col gap-10" data-testid="home">
      <section aria-labelledby="home-title" className="flex max-w-3xl flex-col gap-4" data-testid="home-hero">
        <p className="m-0 text-sm font-semibold tracking-wide text-brand uppercase">Predictive maintenance</p>
        <h2 id="home-title" className="m-0 text-[34px] leading-[1.15] font-bold sm:text-5xl">
          Know which machines are likely to fail before they do, and plan the work to stop it.
        </h2>
        <p className="m-0 text-lg leading-7 text-ink-2">
          PredictIQ reads each machine&rsquo;s sensors and fault logs every hour, estimates the chance it fails in the next 24 hours, and turns the
          riskiest ones into a maintenance plan that fits your crew.
        </p>
        <div>
          <Link href={`/alerts${carried}`} className={cn(buttonVariants({ variant: "primary" }), "min-h-12 px-5 text-base no-underline")} data-testid="see-alerts">
            {n === 0 ? "See the alerts" : `See the ${n} ${n === 1 ? "alert" : "alerts"}`}
          </Link>
        </div>
      </section>

      <section aria-labelledby="plant-title" className={cn(card, "flex flex-col gap-3")} data-testid="plant-status">
        <h2 id="plant-title" className={h2}>
          Demo plant at the simulated plant time
        </h2>
        <p className="m-0 text-sm text-ink-2">
          A simulated plant of {total} machines, replayed hour by hour from simulated historical sensor data. Plant time: {plantTime}.
        </p>
        <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat value={n} label="act today" testId="stat-act" />
          <Stat value={total - n} label="Normal" testId="stat-normal" />
          <Stat value={`${booked} / ${crew}`} label="crew slots booked" testId="stat-slots" />
        </dl>
        <p className="m-0 text-sm text-ink-2">Normal means below the Act today level ({fleet.cutoff_percent}%). It is not a guarantee.</p>
      </section>

      <section aria-labelledby="how-title" className="flex flex-col gap-3">
        <h2 id="how-title" className={h2}>
          How it works
        </h2>
        <p className="m-0 text-sm text-ink-2">The same three steps a maintenance planner takes each shift. Each one has its own page.</p>
        <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="flex gap-3">
              <span aria-hidden="true" className="flex size-9 flex-none items-center justify-center rounded-full bg-sidebar text-base font-bold text-white">
                {i + 1}
              </span>
              <div>
                <h3 className="m-0 text-base font-semibold">{title}</h3>
                <p className="mt-1 mb-0 text-sm leading-6 text-ink-2">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="needs-title" className="flex flex-col gap-3" data-testid="home-alerts">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="needs-title" className={h2}>
            Needs action today
          </h2>
          <Link href={`/alerts${carried}`} className={linkClass}>
            See all alerts
          </Link>
        </div>
        {open.length === 0 ? (
          <p className="m-0 text-sm">No machine is at the Act today level at this simulated plant time.</p>
        ) : (
          <>
            <p className="m-0 text-sm text-ink-2">
              {open.length === 1 ? "This machine has" : `These ${open.length} machines have`} a high chance of failing within 24 hours.
            </p>
            {top.map((r) => (
              <AlertCard key={r.machine_id} r={r} added={jobs.includes(r.machine_id)} onAdd={() => add(r.machine_id)} carried={carried} />
            ))}
          </>
        )}
      </section>

      <section aria-labelledby="go-title" className="flex flex-col gap-3">
        <h2 id="go-title" className={h2}>
          Where to go
        </h2>
        <p className="m-0 text-sm text-ink-2">Start with Alerts. The other pages go deeper.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <GoCard
            fact={`▲ ${n} act today`}
            title="Alerts"
            text="Machines likely to fail in the next 24 hours, with the reason."
            use="decide what the crew looks at first this shift."
            href={`/alerts${carried}`}
            cta="Open Alerts"
          />
          <GoCard
            fact={`${total} machines`}
            title="Assets"
            text="Every machine in the plant: its status, sensor readings, fault history and parts."
            use="look up any machine and see how it is trending."
            href={`/assets${carried}`}
            cta="Browse assets"
          />
          <GoCard
            fact={`${booked} of ${crew} slots booked`}
            title="Work plan"
            text="The jobs for the next shift and the next shutdown window."
            use="schedule repairs within the crew you have."
            href={`/maintenance-planner${carried}`}
            cta="Open work plan"
          />
          <GoCard
            fact={facts ? `${facts.caught} of ${facts.of} failures caught, in a simulated test` : "Simulated test result"}
            title="Alert accuracy"
            text={`How often past alerts were right, measured on ${facts ? `${facts.days} days` : "a period"} of simulated data the model never saw. Real equipment would score lower.`}
            use="judge how far to trust an alert."
            href={`/model-performance${carried}`}
            cta="See accuracy"
          />
        </div>
      </section>

      <section aria-labelledby="who-title" className="flex max-w-3xl flex-col gap-2">
        <h2 id="who-title" className={h2}>
          Who it is for
        </h2>
        <p className="m-0 text-sm leading-6">
          Maintenance planners deciding today&rsquo;s jobs, reliability engineers checking why a machine is at risk, and operations managers who want
          fewer surprise breakdowns.
        </p>
      </section>

      <section aria-labelledby="real-title" className="flex max-w-3xl flex-col gap-2">
        <h2 id="real-title" className={h2}>
          What is real and what is not
        </h2>
        <p className="m-0 text-sm leading-6">
          The machines, sensors and failures come from a public simulated dataset. Costs are example values you can change. Nothing here controls real
          equipment.
        </p>
        <div className="flex flex-wrap gap-x-5">
          <Link href={`/about-data${carried}`} className={linkClass}>
            About this demo
          </Link>
          <Link href={`/real-plant${carried}`} className={linkClass}>
            How it would fit a real plant
          </Link>
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label, testId }: { value: number | string; label: string; testId: string }) {
  return (
    <div className="flex items-baseline gap-2 rounded-md bg-subtle px-3 py-2">
      <dt className="order-2 text-sm text-ink-2">{label}</dt>
      <dd className="tabular order-1 m-0 text-3xl leading-9 font-bold" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function GoCard({ fact, title, text, use, href, cta }: { fact: string; title: string; text: string; use: string; href: string; cta: string }) {
  return (
    <article className={cn(card, "flex flex-col gap-1.5")}>
      <p className="m-0 text-sm font-semibold text-ink-2">{fact}</p>
      <h3 className="m-0 text-lg font-semibold">{title}</h3>
      <p className="m-0 text-sm leading-6 text-ink-2">{text}</p>
      <p className="m-0 text-sm leading-6">
        <strong>Use it to:</strong> {use}
      </p>
      <Link href={href} className={linkClass}>
        {cta}
      </Link>
    </article>
  );
}
