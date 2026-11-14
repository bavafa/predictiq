import type { Metadata } from "next";

import { ModelFacts } from "@/components/model-facts";
import { ValueLabel } from "@/components/value-label";
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
          PredictIQ is a portfolio prototype that estimates which machines may have a recorded failure in the next 24 hours
          and turns those estimates into an assumption-based maintenance list. It is built on a public
          predictive-maintenance sample dataset. It is a demonstration of analytics and product design, not a deployed
          production system.
        </p>
        <p className="mt-3 mb-0">
          <strong>Where it stands.</strong> Two models were trained on the sample data: a simple baseline (logistic
          regression) and a main model (gradient-boosted trees). Their scores for every machine and every hour of a held-out
          later period are saved, and the data service reads only those saved scores. <strong>Fleet Overview</strong>,{" "}
          <strong>Asset Details</strong> and <strong>Maintenance Planner</strong> work on them (the Planner turns them into a ranked list
          using cost assumptions you set; those costs are illustrative). The <strong>Model Performance</strong> page is not built yet,
          and says so. Nothing is calculated live.
        </p>
        <ModelFacts />
      </section>

      <section className={card} aria-labelledby="labels">
        <h2 id="labels" className={h2}>
          How to read the labels
        </h2>
        <ul className="m-0 list-none p-0 text-sm leading-6">
          <li>
            <ValueLabel kind="Historical" /> Simulated sample data as recorded: sensor readings, errors, repairs, failures,
            machine model and age. Not real plant, fleet or mine data.
          </li>
          <li>
            <ValueLabel kind="Predicted" /> A model estimate: the chance of a recorded failure in the next 24 hours, the
            Alert status, and what pushed the estimate up or down.
          </li>
          <li>
            <ValueLabel kind="Illustrative" /> An assumption that can be changed, such as costs and crew slots. Not real costs.
          </li>
        </ul>
        <p className="mt-3 mb-0 text-sm">&ldquo;Historical replay&rdquo; steps through old records in order. Nothing on this site is live.</p>
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
            <li>The scores are saved estimates for a held-out replay period, not forecasts for any real equipment.</li>
            <li>The model was also tried on 20 machines it never saw, and results are in the model card; the Model Performance page is not built yet.</li>
            <li>Explanations are patterns the model found, not causes.</li>
            <li>Costs in the maintenance list are illustrative assumptions you set. They are not real costs and promise no financial result.</li>
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
