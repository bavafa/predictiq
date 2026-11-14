import type { Metadata } from "next";

import { PROVENANCE_URL } from "@/lib/nav";

export const metadata: Metadata = { title: "About & Data — PredictIQ" };

const card = "rounded-lg border border-line bg-card px-4 py-4 sm:px-5";
const h2 = "m-0 mb-1 text-lg leading-7 font-semibold";

export default function AboutDataPage() {
  return (
    <>
      <section className={card}>
        <h2 className={h2}>What this is</h2>
        <p className="m-0">
          PredictIQ is a portfolio prototype that will turn machine-failure predictions into maintenance decisions. It
          is built on a public predictive-maintenance sample dataset. <strong>Current status: project skeleton only.</strong>{" "}
          No model has been trained and nothing is scored yet, so the other pages show &ldquo;not built yet&rdquo; states
          instead of numbers.
        </p>
      </section>

      <section className={card} aria-labelledby="source">
        <h2 id="source" className={h2}>
          Data source
        </h2>
        <p className="m-0">
          The data is <strong>simulated sample data published by Microsoft</strong>: the &ldquo;Predictive Maintenance
          Modelling Guide&rdquo; dataset (2015). It is not real plant, fleet or mine data.
        </p>
        <p className="mt-3 mb-0">
          Data: Microsoft Predictive Maintenance Modelling Guide sample dataset (simulated), from
          github.com/microsoft/sqlworkshops (pinned commit e836f4e). Microsoft states content in that repository is
          licensed under CC BY 4.0; the repository&rsquo;s license file is MIT.
        </p>
        <ul className="mt-3 mb-0 list-disc pl-5 text-sm leading-6 text-ink-2">
          <li>100 machines with hourly sensor readings, 2015-01-01 06:00 to 2016-01-01 06:00.</li>
          <li>Also error logs, maintenance records, failure records, and each machine&rsquo;s model and age.</li>
          <li>Sensor units are not stated by the source.</li>
          <li>Raw files are not stored in this repository; a script downloads them and checks SHA-256 fingerprints.</li>
        </ul>
        <p className="mt-3 mb-0">
          <a className="inline-flex min-h-11 items-center text-link underline" href={PROVENANCE_URL}>
            Full data record (source, file checks, license notes) ↗
          </a>
          <br />
          <span className="text-xs leading-4 text-ink-2">
            Opens the public data provenance page in the project&rsquo;s code repository, in the same tab.
          </span>
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className={card}>
          <h2 className={h2}>Known limitations</h2>
          <ul className="m-0 list-disc pl-5 text-sm leading-6">
            <li>The data is simulated, so results may look better than on real machines.</li>
            <li>There is no model yet. Nothing here is a prediction.</li>
            <li>Costs, when added, will be illustrative. No savings are claimed.</li>
          </ul>
        </div>
        <div className={card}>
          <h2 className={h2}>Not part of this demo</h2>
          <ul className="m-0 list-disc pl-5 text-sm leading-6">
            <li>Live sensor feeds or control of any equipment.</li>
            <li>Real maintenance costs or work orders.</li>
            <li>Accounts, personal data, chatbots.</li>
          </ul>
        </div>
      </section>
    </>
  );
}
