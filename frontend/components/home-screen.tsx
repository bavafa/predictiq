"use client";

import { Bell, ClipboardCheck, Factory, Target, TriangleAlert, ArrowRight } from "lucide-react";
import Link from "next/link";

import { useData } from "@/components/data-provider";
import { latestErrorText } from "@/components/fleet-table";
import { NoModelData, ServiceError, Skeleton } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import type { FleetRow } from "@/lib/types";
import { slotsUsed, useJobs } from "@/lib/jobs";
import { crewSlots, usePlanSettings } from "@/lib/plan-settings";
import { caughtFacts, parseResults } from "@/lib/model-performance";
import { parseHour } from "@/lib/time";
import { machineName } from "@/lib/machine-types";
import type { Fleet, ReadyMetadata } from "@/lib/types";
import { carriedSearch } from "@/lib/url-state";
import { useApiQuery } from "@/lib/use-api-query";
import { cn } from "@/lib/utils";

const card = "rounded-lg border border-line bg-card p-4 sm:p-6";
const h2 = "m-0 text-xl leading-7 font-semibold";
const FAULTS: Record<string, string> = { "4": "Overpressure fault", "5": "Vibration fault" };

/** "Vibration fault (error 5)" from the latest error record, or a plain note when there is none. */
function faultText(e: FleetRow["latest_error"]): string {
  if (!e) return "No error record yet; flagged from sensor and age patterns";
  const n = e.error.match(/\d+/)?.[0];
  return n ? `${FAULTS[n] ?? "Fault"} (error ${n})` : latestErrorText(e);
}

/** "Sun 1 Nov 2015, 00:00" (plant time is UTC hours). */
function plantClock(h: number): string {
  const d = new Date(h * 3_600_000);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).replace(",", "");
  return `${day}, ${String(d.getUTCHours()).padStart(2, "0")}:00`;
}
const linkClass = "flex min-h-11 w-fit items-center text-[15px] font-semibold";

const STEPS = [
  ["Spot the risk", "Every hour each machine gets a status: Act today if it is likely to fail within 24 hours, otherwise Normal."],
  ["Check the evidence", "Open a machine to see which sensor or fault triggered the alert and which part is most likely to go."],
  ["Plan the work", "Add jobs to the work plan. It puts the costliest risks first and fills the crew slots you have."],
] as const;

/** The v2 landing page (decision 83): what the product is, the plant at the simulated plant time, and where to go. */
export function HomeScreen() {
  const { client, meta, view, search } = useData();
  const { settings } = usePlanSettings();
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
  return <Body fleet={fleet.data} carried={carriedSearch(search)} crew={crewSlots(ready as ReadyMetadata, settings)} />;
}

function Body({ fleet, carried, crew }: { fleet: Fleet; carried: string; crew: number }) {
  const { client, meta, replay } = useData();
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
  const plantTime = h === null ? fleet.at : plantClock(h);
  const n = actToday.length;

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-10 lg:pt-6" data-testid="home">
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_440px]">
        <section aria-labelledby="home-title" className="flex flex-col gap-4" data-testid="home-hero">
          <p className="m-0 text-sm font-semibold tracking-wide text-brand uppercase">Predictive maintenance</p>
          <h1 id="home-title" className="m-0 text-[34px] leading-[1.15] font-bold sm:text-5xl">
            Know which machines will fail before they do, and plan the work to stop it.
          </h1>
          <p className="m-0 max-w-xl text-lg leading-7 text-ink-2">
            PredictIQ reads each machine&rsquo;s sensors and fault logs every hour, estimates the chance it fails in the next 24 hours, and turns the
            riskiest ones into a maintenance plan that fits your crew.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/alerts${carried}`} className={cn(buttonVariants({ variant: "primary" }), "min-h-12 px-5 text-base no-underline")} data-testid="see-alerts">
              {n === 0 ? "See the alerts" : `See the ${n} ${n === 1 ? "alert" : "alerts"}`}
            </Link>
            <a href="#how" className={cn(buttonVariants(), "min-h-12 px-5 text-base no-underline")}>
              How it works
            </a>
          </div>
        </section>

        <section aria-labelledby="plant-title" className={cn(card, "flex flex-col gap-4")} data-testid="plant-status">
          <h2 id="plant-title" className="m-0 flex items-center gap-2 text-base font-semibold">
            <Factory aria-hidden="true" size={20} /> Demo plant right now
          </h2>
          <p className="m-0 text-sm leading-6 text-ink-2">
            A simulated plant of {total} machines, replayed hour by hour from one year of recorded sensor data. Plant time: <strong className="text-ink">{plantTime}</strong>.
          </p>
          <dl className="m-0 grid grid-cols-3 gap-3">
            <Stat value={n} label="act today" testId="stat-act" hot />
            <Stat value={total - n} label="running normally" testId="stat-normal" />
            <Stat value={`${booked} / ${crew}`} label="crew slots booked" testId="stat-slots" />
          </dl>
          <Button disabled={!replay || replay.atEnd} onClick={() => replay?.stepForward()} className="min-h-11 w-full">
            Advance plant time 1 hour
          </Button>
        </section>
      </div>

      <section id="how" aria-labelledby="how-title" className="flex scroll-mt-4 flex-col gap-3">
        <h2 id="how-title" className={h2}>
          How it works
        </h2>
        <p className="m-0 text-sm text-ink-2">The same three steps a maintenance planner takes each shift. Each one has its own page.</p>
        <ol className="m-0 grid list-none gap-6 p-0 md:grid-cols-3">
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

      <section aria-labelledby="needs-title" className={cn(card, "flex flex-col gap-4")} data-testid="home-alerts">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="needs-title" className={h2}>
              Needs action today
            </h2>
            {open.length === 0 ? (
              <p className="mt-1 mb-0 text-sm">No machine is at the Act today level at this simulated plant time.</p>
            ) : (
              <p className="mt-1 mb-0 text-sm text-ink-2">
                {open.length === 1 ? "This machine has" : `These ${open.length} machines have`} a high chance of failing within 24 hours. Ranked by what a
                failure would cost.
              </p>
            )}
          </div>
          <Link href={`/alerts${carried}`} className={cn(linkClass, "gap-2 underline")}>
            See all alerts <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <ul className="m-0 flex list-none flex-col p-0">
          {top.map((r, i) => (
            <HomeRow key={r.machine_id} r={r} rank={i + 1} added={jobs.includes(r.machine_id)} onAdd={() => add(r.machine_id)} carried={carried} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="go-title" className="flex flex-col gap-3">
        <h2 id="go-title" className={h2}>
          Where to go
        </h2>
        <p className="m-0 text-sm text-ink-2">Start with Alerts. The other pages go deeper.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <GoCard
            icon={Bell}
            highlight
            fact={`▲ ${n} act today`}
            title="Alerts"
            text="Machines likely to fail in the next 24 hours, most costly first, each with the reason."
            use="decide what the crew looks at first this shift."
            href={`/alerts${carried}`}
            cta="Open Alerts"
          />
          <GoCard
            icon={Factory}
            fact={`${total} machines`}
            title="Assets"
            text="Every machine in the plant: its status, sensor readings, fault history and parts."
            use="look up any machine and see how it is trending."
            href={`/assets${carried}`}
            cta="Browse assets"
          />
          <GoCard
            icon={ClipboardCheck}
            fact={`${booked} of ${crew} slots booked`}
            title="Work plan"
            text="The jobs for the next shift and the next shutdown window, ranked by cost at risk."
            use="schedule repairs within the crew you have."
            href={`/maintenance-planner${carried}`}
            cta="Open work plan"
          />
          <GoCard
            icon={Target}
            fact={facts ? `${facts.caught} of ${facts.of} failures caught` : "Simulated test result"}
            title="Alert accuracy"
            text={`How often past alerts were right, measured on ${facts ? `${facts.days} days` : "a period"} the model never saw.`}
            use="judge how far to trust an alert."
            href={`/model-performance${carried}`}
            cta="See accuracy"
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="who-title" className={cn(card, "flex flex-col gap-2")}>
          <h2 id="who-title" className="m-0 text-base font-semibold">
            Who it is for
          </h2>
          <p className="m-0 text-sm leading-6 text-ink-2">
            Maintenance planners deciding today&rsquo;s jobs, reliability engineers checking why a machine is at risk, and operations managers who want
            fewer surprise breakdowns.
          </p>
        </section>

        <section aria-labelledby="real-title" className={cn(card, "flex flex-col gap-2")}>
          <h2 id="real-title" className="m-0 text-base font-semibold">
            What is real and what is not
          </h2>
          <p className="m-0 text-sm leading-6 text-ink-2">
            The machines, sensors and failures come from a public simulated dataset. Costs are example values you can change. Nothing here controls real
            equipment.{" "}
            <Link href={`/about-data${carried}`} className="inline-flex min-h-11 items-center underline">
              About this demo
            </Link>
            <span aria-hidden="true"> · </span>
            <Link href={`/real-plant${carried}`} className="inline-flex min-h-11 items-center underline">
              How it would fit a real plant
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}

/** One ranked row on Home: rank, tag, machine, the fault and the likely part, and Add to work plan. */
function HomeRow({ r, rank, added, onAdd, carried }: { r: FleetRow; rank: number; added: boolean; onAdd: () => void; carried: string }) {
  const { client, meta, view } = useData();
  const version = meta.status === "ready" ? meta.meta.model_version : "";
  const parts = useApiQuery((signal) => client.components(r.machine_id, { at: view!.at }, { signal }), [client, version, r.machine_id, view?.at]);
  const part = parts.status === "ready" ? parts.data.parts.filter((p) => p.warning_active).sort((a, b) => b.warning_chance_48h - a.warning_chance_48h)[0] : null;
  const p = new URLSearchParams(carried);
  p.set("machine", String(r.machine_id));
  const name = machineName(r.machine_id);
  return (
    <li className="flex flex-wrap items-center gap-4 border-t border-line py-4" data-testid="alert-card">
      <span className="w-8 text-sm font-semibold text-ink-2">#{rank}</span>
      <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1 rounded-sm border border-alert-edge bg-alert-bg px-2 text-[13px] leading-6 font-bold text-alert-text">
            <TriangleAlert aria-hidden="true" size={12} /> Act today<span className="sr-only">, predicted</span>
          </span>
          <Link href={`/asset-details?${p.toString()}`} className="text-base font-semibold underline">
            {name}
          </Link>
        </div>
        <p className="m-0 text-[13px] text-ink-2">
          {faultText(r.latest_error)}
          {part && <> · likely part: {part.part_name}</>}
        </p>
      </div>
      {added ? (
        <Link href={`/maintenance-planner${carried}`} className={cn(buttonVariants(), "no-underline")}>
          <span aria-hidden="true">✓</span> In work plan<span className="sr-only">: {name}</span>
        </Link>
      ) : (
        <Button onClick={onAdd}>
          Add to work plan<span className="sr-only">: {name}</span>
        </Button>
      )}
    </li>
  );
}

function Stat({ value, label, testId, hot }: { value: number | string; label: string; testId: string; hot?: boolean }) {
  return (
    <div className={cn("flex flex-col rounded-md px-3 py-3", hot ? "border border-alert-edge bg-alert-bg text-alert-text" : "bg-subtle")}>
      <dt className="order-2 text-xs leading-4">{label}</dt>
      <dd className="tabular order-1 m-0 text-3xl leading-9 font-bold" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function GoCard({
  icon: Icon,
  fact,
  title,
  text,
  use,
  href,
  cta,
  highlight,
}: {
  icon: typeof Bell;
  fact: string;
  title: string;
  text: string;
  use: string;
  href: string;
  cta: string;
  highlight?: boolean;
}) {
  return (
    <article className={cn(card, "flex flex-col gap-2 p-5", highlight && "border-2 border-brand")}>
      <div className="flex items-start justify-between gap-2">
        <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-md bg-subtle text-ink-2">
          <Icon size={20} />
        </span>
        <p className="m-0 text-right text-[13px] font-semibold text-ink-2">{fact}</p>
      </div>
      <h3 className="m-0 mt-2 text-lg font-semibold">{title}</h3>
      <p className="m-0 text-sm leading-6 text-ink-2">{text}</p>
      <p className="m-0 text-sm leading-6">
        <strong>Use it to:</strong> {use}
      </p>
      <Link href={href} className={cn(linkClass, "mt-auto gap-2 no-underline", highlight && "text-brand")}>
        {cta} <ArrowRight aria-hidden="true" size={16} />
      </Link>
    </article>
  );
}
