import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "In a real plant — PredictIQ" };

const card = "rounded-lg border border-line bg-card px-4 py-4 sm:px-5";
const h2 = "m-0 mb-1 text-lg leading-7 font-semibold";
const list = "m-0 mt-2 pl-5 text-sm leading-6";

const ROLES: [string, string, string][] = [
  [
    "Reliability engineer",
    "Triage: is the alert real? Checks the trend, recent work and the factors shown.",
    "Within the shift",
  ],
  [
    "Maintenance planner / scheduler",
    "Turns a confirmed alert into a planned work order, parts and a slot in the next window.",
    "Next planning cycle",
  ],
  [
    "Area supervisor",
    "Agrees downtime with operations; decides run-to-window or stop now.",
    "Same day if urgent",
  ],
  [
    "Technician",
    "Does the inspection or repair; records what was found (the failure code).",
    "Per work order",
  ],
  [
    "Operations",
    "Accepts the downtime window; reports anything the sensors cannot see.",
    "As agreed",
  ],
];

export default function RealPlantPage() {
  return (
    <>
      <section className={card}>
        <h2 className={h2}>What this page is</h2>
        <p className="m-0">
          How a tool like PredictIQ would sit inside a working plant, from first
          alert to handover. This is a design sketch: none of these integrations
          exist in this demo, which runs on simulated sample data. Product names
          are examples of common systems, not systems this demo connects to.
        </p>
      </section>

      <section className={card} aria-labelledby="flow">
        <h2 id="flow" className={h2}>
          From alert to work order
        </h2>
        <ol className={`${list} list-decimal`}>
          <li>
            <strong>Score.</strong> Every hour, the model scores each machine
            from the latest historian data and the maintenance history.
          </li>
          <li>
            <strong>Alert.</strong> A machine at or above the agreed cut-off
            raises a <em>notification</em> in the CMMS (not a work order yet),
            with the score, the top factors and a link to the trend.
          </li>
          <li>
            <strong>Triage.</strong> The reliability engineer confirms,
            dismisses (with a reason) or asks for an inspection. A dismissal is
            data: it feeds the next model review.
          </li>
          <li>
            <strong>Plan.</strong> A confirmed alert becomes a work order with a
            priority, parts, labour and a target window, ranked the way the
            Work plan ranks machines: by expected cost, not by score
            alone.
          </li>
          <li>
            <strong>Execute and close.</strong> The technician records what was
            found. Failure codes and the actual repair close the loop and become
            the labels the model is retrained on.
          </li>
        </ol>
      </section>

      <section className={card} aria-labelledby="who">
        <h2 id="who" className={h2}>
          Who acts on an alert
        </h2>
        <dl className="m-0 mt-2 text-sm leading-6">
          {ROLES.map(([role, what, when]) => (
            <div key={role} className="border-b border-line py-2">
              <dt className="font-semibold">{role}</dt>
              <dd className="m-0">
                {what} <span className="text-ink-2">Timing: {when}.</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 mb-0 text-sm text-ink-2">
          The model never stops a machine. People decide; the tool ranks and
          explains.
        </p>
      </section>

      <section className={card} aria-labelledby="cmms">
        <h2 id="cmms" className={h2}>
          CMMS integration
        </h2>
        <ul className={`${list} list-disc`}>
          <li>
            <strong>Out:</strong> notifications with machine, score, cut-off,
            top factors and model version, through the CMMS&rsquo;s own
            interface (for example SAP PM notifications or Maximo service
            requests). No direct database writes.
          </li>
          <li>
            <strong>In:</strong> asset register (machine, model, install date),
            work orders, component replacements and failure codes. These replace
            the sample&rsquo;s maintenance and failure tables.
          </li>
          <li>
            <strong>Asset IDs</strong> are mapped once and owned by the CMMS;
            the tool never invents an asset.
          </li>
          <li>
            <strong>Duplicates:</strong> one open notification per machine; a
            new alert updates it instead of raising another.
          </li>
        </ul>
      </section>

      <section className={card} aria-labelledby="historian">
        <h2 id="historian" className={h2}>
          Historian integration
        </h2>
        <ul className={`${list} list-disc`}>
          <li>
            <strong>Read-only</strong> access to the plant historian (for
            example AVEVA PI or a similar time-series store), through its
            standard interface, on the IT side of the network boundary. Nothing
            writes back to control systems.
          </li>
          <li>
            <strong>Tag map:</strong> each model input (voltage, speed,
            pressure, vibration) maps to a named tag per machine, with units
            confirmed on site. In this demo the units are assumed.
          </li>
          <li>
            <strong>Hourly aggregates</strong> (mean, spread, last value),
            computed the same way in training and in service, so the model sees
            what it was trained on.
          </li>
          <li>
            <strong>Data quality first:</strong> stale, flat-lined or
            bad-quality tags suppress the score and say why, rather than produce
            a confident number from bad data.
          </li>
        </ul>
      </section>

      <section className={card} aria-labelledby="handover">
        <h2 id="handover" className={h2}>
          Handover after commissioning
        </h2>
        <ol className={`${list} list-decimal`}>
          <li>
            <strong>Shadow run</strong> (for example 8 to 12 weeks): alerts are
            logged, not sent, and compared with what actually failed. The
            cut-off is set on site data, with operations and maintenance in the
            room.
          </li>
          <li>
            <strong>Acceptance criteria</strong> agreed up front: how many real
            failures it must catch, and how many false alerts per week the crews
            will accept.
          </li>
          <li>
            <strong>Handover pack:</strong> model card, tag map, cut-off and its
            reasoning, runbook for data outages, and the rollback step (switch
            alerts off; the plant runs as before).
          </li>
          <li>
            <strong>Named owner</strong> on site for the model, with a monthly
            review: alert volume, hit rate, dismissed alerts and input drift.
          </li>
          <li>
            <strong>Retraining</strong> on new failure records, under management
            of change: a new version is validated on held-out recent data and
            shadow-run before it replaces the old one. Every alert records the
            model version that raised it.
          </li>
        </ol>
      </section>

      <section className={card} aria-labelledby="demo-gap">
        <h2 id="demo-gap" className={h2}>
          What this demo shows of that, and what it does not
        </h2>
        <ul className={`${list} list-disc`}>
          <li>
            <strong>Shows:</strong> the scoring, ranking by expected cost,
            explanations, a fixed cut-off, a model version on every screen, and
            honest labels.
          </li>
          <li>
            <strong>Does not:</strong> connect to any CMMS or historian, raise
            notifications, learn from dismissals or retrain. The data is
            simulated, the machine types and units are best guesses, and the
            costs are illustrative.
          </li>
        </ul>
        <p className="mt-3 mb-0 text-sm">
          <Link href="/about-data" className="inline-flex min-h-11 items-center text-link underline">
            Data and limitations: About this demo
          </Link>
        </p>
      </section>
    </>
  );
}
