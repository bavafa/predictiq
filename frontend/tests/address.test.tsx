import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataProvider, useData } from "@/components/data-provider";
import { createApiClient } from "@/lib/api";
import { fakeFetch, readyMetadata, setAddress } from "./helpers";

vi.mock("next/navigation", () => ({ usePathname: () => "/asset-details" }));

function Probe() {
  const { search, view } = useData();
  return (
    <p data-testid="probe">
      {search}|{view?.machine.kind === "ok" ? view.machine.id : "none"}
    </p>
  );
}

beforeEach(() => setAddress("", "/"));

describe("the web address", () => {
  it("is re-read when the app moves to another page with pushState (a link click), not only on Back/Forward", async () => {
    render(
      <DataProvider client={createApiClient(fakeFetch(readyMetadata()))}>
        <Probe />
      </DataProvider>,
    );
    await screen.findByText(/\|none/);
    act(() => window.history.pushState(null, "", "/asset-details?machine=3"));
    expect(screen.getByTestId("probe").textContent).toBe("?machine=3|3");
    act(() => window.history.replaceState(null, "", "/asset-details?machine=4"));
    expect(screen.getByTestId("probe").textContent).toBe("?machine=4|4");
  });
});
