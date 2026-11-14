import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ScreenGate } from "@/components/screen-gate";
import { fakeFetch, json, noModelMetadata, problem, readyMetadata, renderWithData } from "./helpers";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
afterEach(() => vi.useRealTimers());

describe("ScreenGate states", () => {
  it("shows grey blocks while loading, then the screen", async () => {
    renderWithData(<ScreenGate what="the fleet">screen body</ScreenGate>, fakeFetch(readyMetadata()));
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
    expect(await screen.findByText("screen body")).toBeInTheDocument();
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
  });

  it("NO-MODEL-DATA: plain wording, no screen, no numbers", async () => {
    const { container } = renderWithData(
      <ScreenGate what="the fleet">screen body</ScreenGate>,
      fakeFetch(noModelMetadata()),
    );
    const state = await screen.findByTestId("no-model-data");
    expect(state).toHaveTextContent("The model data isn't installed in this preview");
    expect(screen.queryByText("screen body")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /About & Data/ })).toHaveAttribute("href", "/about-data");
    expect(container.textContent).not.toMatch(/[0-9]/);
  });

  it("a 5xx failure shows what failed with Try again, and Try again recovers", async () => {
    let up = false;
    const f = fakeFetch(() => (up ? json(readyMetadata()) : problem(500, "Internal error")));
    renderWithData(<ScreenGate what="the fleet">screen body</ScreenGate>, f);
    const err = await screen.findByTestId("service-error");
    expect(err).toHaveTextContent("Couldn't load the fleet.");
    expect(err).toHaveTextContent("Your settings are kept.");
    up = true;
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("screen body")).toBeInTheDocument();
  });

  it("a network failure says the service could not be reached", async () => {
    const f = vi.fn(async () => {
      throw new TypeError("offline");
    });
    renderWithData(<ScreenGate what="the fleet">screen body</ScreenGate>, f);
    expect(await screen.findByTestId("service-error")).toHaveTextContent("could not be reached");
  });

  it("says the data service is waking up when it is slow, and fills in by itself", async () => {
    vi.useFakeTimers();
    let release: (r: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    renderWithData(<ScreenGate what="the fleet">screen body</ScreenGate>, fakeFetch(() => pending));
    expect(screen.queryByTestId("waking-up")).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    const waking = screen.getByTestId("waking-up");
    expect(waking).toHaveTextContent("Waking up the data service…");
    expect(waking).toHaveTextContent("This can take up to a minute. The page fills in by itself.");
    expect(screen.getByRole("link", { name: /Read about the data while you wait/ })).toBeInTheDocument();
    release(json(readyMetadata()));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByText("screen body")).toBeInTheDocument();
    expect(screen.queryByTestId("waking-up")).not.toBeInTheDocument();
  });
});
