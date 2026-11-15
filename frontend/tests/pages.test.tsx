import { screen } from "@testing-library/react";
import { vi } from "vitest";
import { describe, expect, it } from "vitest";

import AboutDataPage from "@/app/about-data/page";
import { PROVENANCE_URL } from "@/lib/nav";
import { fakeFetch, problem, readyMetadata, renderWithData } from "./helpers";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("About & Data", () => {
  it("calls the data simulated, credits Microsoft and links the provenance document", () => {
    const { container } = renderWithData(<AboutDataPage />, fakeFetch(readyMetadata()));
    expect(container.textContent).toMatch(/simulated sample data published by Microsoft/);
    expect(container.textContent).toMatch(/pinned commit e836f4e/);
    expect(container.textContent).toMatch(/CC BY 4\.0; the repository.s license file is MIT/);
    expect(screen.getByRole("link", { name: /Full data record/ })).toHaveAttribute("href", PROVENANCE_URL);
  });

  it("describes the current state, not the old skeleton", () => {
    const { container } = renderWithData(<AboutDataPage />, fakeFetch(readyMetadata()));
    expect(container.textContent).not.toMatch(/skeleton only|No model has been trained|no model yet/i);
    expect(container.textContent).toMatch(/Two models were trained/);
    expect(container.textContent).toMatch(/Nothing on this site is live/);
    expect(container.textContent).toMatch(/Maintenance Planner.*illustrative.*Model Performance.*saved evaluation/);
  });

  it("has a complete limitations section that matches the model card and Model Performance page", () => {
    renderWithData(<AboutDataPage />, fakeFetch(readyMetadata()));
    const box = screen.getByTestId("about-limitations");
    expect(screen.getByRole("heading", { name: "Limitations and what this demo does not do" })).toBeInTheDocument();
    for (const phrase of [
      /simulated/i,
      /One year of data from 100 machines/,
      /110 failure\s+events/,
      /20 machines they never saw/,
      /looked at once/,
      /Replay, not live/,
      /patterns, not causes/,
      /not real costs/,
      /Parts plan.*illustrative.*not an early warning/,
      /live sensor feeds/,
      /real-world result/,
    ]) {
      expect(box.textContent).toMatch(phrase);
    }
  });

  it("reads the model version, date, cut-off and replay window from /metadata", async () => {
    renderWithData(
      <AboutDataPage />,
      fakeFetch(readyMetadata({ model_created: "20261114" })),
    );
    const facts = await screen.findByText("piq-test-1");
    expect(facts).toBeInTheDocument();
    const box = screen.getByTestId("model-facts");
    expect(box).toHaveTextContent("14 November 2026");
    expect(box).toHaveTextContent("51% (chosen on validation data only)");
    expect(box).toHaveTextContent("1 Nov 2015, 00:00 to 3 Nov 2015, 00:00");
  });

  it("shows — for the facts when /metadata can't be read, and the rest stays", async () => {
    const { container } = renderWithData(<AboutDataPage />, async () => problem(500, "boom"));
    expect(await screen.findByText(/couldn.t load right now/)).toBeInTheDocument();
    expect(screen.getByTestId("model-facts").textContent).toMatch(/Model version—/);
    expect(container.textContent).toMatch(/simulated sample data published by Microsoft/);
  });
});

describe("In a Real Plant", () => {
  it("covers the lifecycle and says none of it is built in this demo", async () => {
    const { default: RealPlantPage } = await import("@/app/real-plant/page");
    const { container } = renderWithData(<RealPlantPage />, fakeFetch(readyMetadata()));
    for (const name of ["From alert to work order", "Who acts on an alert", "CMMS integration", "Historian integration", "Handover after commissioning"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    expect(container.textContent).toMatch(/none of these integrations exist in this demo/);
    expect(container.textContent).toMatch(/simulated/);
  });
});
