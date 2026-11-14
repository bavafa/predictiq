import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { describe, expect, it } from "vitest";

import AboutDataPage from "@/app/about-data/page";
import AssetDetailsPage from "@/app/asset-details/page";
import MaintenancePlannerPage from "@/app/maintenance-planner/page";
import ModelPerformancePage from "@/app/model-performance/page";
import { PROVENANCE_URL } from "@/lib/nav";
import { fakeFetch, readyMetadata, renderWithData } from "./helpers";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const emptyPages = [
  ["Asset Details", AssetDetailsPage],
  ["Maintenance Planner", MaintenancePlannerPage],
  ["Model Performance", ModelPerformancePage],
] as const;

describe.each(emptyPages)("%s", (_name, Page) => {
  it("is an honest empty state: no numbers, charts, tables or controls", async () => {
    const { container } = renderWithData(<Page />, fakeFetch(readyMetadata()));
    expect(await screen.findByRole("heading", { level: 2 })).toHaveTextContent("Not built yet");
    // The only digits allowed are the prose "24 hours" horizon; no values.
    expect((container.textContent ?? "").replace(/24 hours/g, "")).not.toMatch(/\d/);
    expect(container.querySelector("table, svg, canvas, input, button, a")).toBeNull();
  });
});

describe("About & Data", () => {
  it("calls the data simulated, credits Microsoft and links the provenance document", () => {
    const { container } = render(<AboutDataPage />);
    expect(container.textContent).toMatch(/simulated sample data published by Microsoft/);
    expect(container.textContent).toMatch(/pinned commit e836f4e/);
    expect(container.textContent).toMatch(/CC BY 4\.0; the repository.s license file is MIT/);
    expect(screen.getByRole("link", { name: /Full data record/ })).toHaveAttribute("href", PROVENANCE_URL);
  });

  it("does not claim a model exists", () => {
    const { container } = render(<AboutDataPage />);
    expect(container.textContent).toMatch(/skeleton only/);
    expect(container.textContent).toMatch(/No model has been trained/);
  });
});
