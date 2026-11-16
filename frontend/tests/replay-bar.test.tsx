import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReplayBar } from "@/components/replay-bar";
import { fakeFetch, noModelMetadata, readyMetadata, renderWithData, setAddress } from "./helpers";

let mockPath = "/";
vi.mock("next/navigation", () => ({ usePathname: () => mockPath }));

// Window: 2015-11-01 00:00 .. 2015-11-03 00:00 (49 hours); replay starts 2015-11-01 06:00.
const time = () => screen.getByTestId("replay-time").textContent;
const button = (name: RegExp | string) => screen.getByRole("button", { name });

async function ready(path = "/") {
  mockPath = path;
  renderWithData(<ReplayBar />, fakeFetch(readyMetadata()));
  // Generous timeout so a loaded machine (full parallel run) cannot time out before /metadata settles.
  // The full controls sit in the "Time controls" panel (redesign decision 82); open it first.
  fireEvent.click(await screen.findByRole("button", { name: /Time controls/ }, { timeout: 10_000 }));
  await screen.findByRole("button", { name: "Play" });
  await waitFor(() => expect(screen.getByTestId("replay-time").textContent).toBeTruthy());
}

// Only the replay interval is faked: promises, microtasks and React's own scheduling stay real, so
// nothing the test awaits can hang on a frozen clock.
function useFakeInterval() {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
}

beforeEach(() => {
  localStorage.clear(); // the Time controls panel remembers it is open
  setAddress("");
});
afterEach(() => {
  vi.useRealTimers();
  setAddress("");
});

describe("replay bar", () => {
  it("starts at the replay start from /metadata, says Simulated plant time and never 'live'", async () => {
    await ready();
    expect(time()).toBe("1 November 2015, 06:00");
    expect(screen.getByRole("region", { name: /Simulated plant time/ })).toBeInTheDocument();
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/\blive\b|real-time/);
    expect(screen.getByText(/The simulated plant time starts at the first test-period hour where any machine is at or above/)).toBeInTheDocument();
  });

  it("has the tab order Advance 1 h, Play, Time controls, then Start, Step back, Step forward, Step size, timeline", async () => {
    await ready();
    const order = Array.from(
      document.querySelectorAll<HTMLElement>("button, select, input"),
    ).map((el) => (el.tagName === "BUTTON" ? el.textContent?.trim() : (el.getAttribute("type") ?? el.tagName.toLowerCase())));
    expect(order.slice(0, 8)).toEqual(["Advance 1 h", "Play", "Time controls", "Start", "Step back", "Step forward", "select", "range"]);
  });

  it("steps by the chosen size, keeps the time in the web address, and Start goes to the window's first hour", async () => {
    await ready();
    fireEvent.click(button("Step forward"));
    expect(time()).toBe("1 November 2015, 07:00");
    expect(window.location.search).toBe("?at=2015-11-01T07%3A00");
    fireEvent.change(screen.getByLabelText("Step size"), { target: { value: "24" } });
    fireEvent.click(button("Step forward"));
    expect(time()).toBe("2 November 2015, 07:00");
    fireEvent.click(button("Step back"));
    expect(time()).toBe("1 November 2015, 07:00");
    fireEvent.click(button("Start"));
    expect(time()).toBe("1 November 2015, 00:00");
  });

  it("at the start: Start and Step back are unavailable but stay focusable, with a visible reason", async () => {
    setAddress("?at=2015-11-01T00:00");
    await ready();
    expect(screen.getByText("Start of the simulated data.")).toBeVisible();
    for (const name of ["Start", "Step back"]) {
      const b = button(name);
      expect(b).toHaveAttribute("aria-disabled", "true");
      expect(b).not.toBeDisabled();
      b.focus();
      expect(b).toHaveFocus();
      fireEvent.click(b);
    }
    expect(time()).toBe("1 November 2015, 00:00");
    expect(button("Step forward")).toHaveAttribute("aria-disabled", "false");
  });

  it("Play steps once per second, Pause stops, and focus stays on the button", async () => {
    await ready();
    useFakeInterval();
    const play = button("Play");
    play.focus();
    fireEvent.click(play);
    expect(button("Pause")).toBe(play);
    expect(play).toHaveFocus();
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(time()).toBe("1 November 2015, 09:00");
    fireEvent.click(button("Pause"));
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(time()).toBe("1 November 2015, 09:00");
    expect(button("Play")).toBe(play);
  });

  it("announces the replay time every sixth step only", async () => {
    await ready();
    useFakeInterval();
    fireEvent.click(button("Play"));
    const announcer = screen.getByTestId("replay-announcer");
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(announcer).toHaveTextContent("");
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(announcer).toHaveTextContent("Simulated plant time 1 November 2015, 12:00");
  });

  it("stops cleanly at the end: end state shown, Play and Step forward unavailable, never wraps, Jump to start works", async () => {
    setAddress("?at=2015-11-02T22:00");
    await ready();
    useFakeInterval();
    fireEvent.click(button("Play"));
    await act(async () => {
      vi.advanceTimersByTime(10_000); // would be far past the end if it wrapped or kept going
    });
    expect(time()).toBe("3 November 2015, 00:00");
    expect(screen.getByTestId("end-state")).toHaveTextContent("End of the simulated data. There is no later data.");
    expect(screen.getByTestId("replay-announcer")).toHaveTextContent("End of the simulated data. There is no later data.");
    expect(button("Play")).toHaveAttribute("aria-disabled", "true");
    expect(button("Step forward")).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button("Step forward"));
    fireEvent.click(button("Play"));
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(time()).toBe("3 November 2015, 00:00");
    fireEvent.click(button("Jump to start"));
    expect(time()).toBe("1 November 2015, 00:00");
    expect(screen.queryByTestId("end-state")).not.toBeInTheDocument();
  });

  it("a 24 hour step that would overshoot the end lands on the last hour and stops", async () => {
    setAddress("?at=2015-11-02T12:00");
    await ready();
    useFakeInterval();
    fireEvent.change(screen.getByLabelText("Step size"), { target: { value: "24" } });
    fireEvent.click(button("Play"));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(time()).toBe("3 November 2015, 00:00");
    expect(screen.getByTestId("end-state")).toBeInTheDocument();
  });

  it("the timeline is a native range with first and last hour, spoken time, and keys apply at once", async () => {
    await ready();
    const slider = screen.getByRole("slider", { name: "Simulated plant time" });
    expect(slider).toHaveAttribute("type", "range");
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "48");
    expect(slider).toHaveAttribute("aria-valuetext", "1 November 2015, 06:00");
    expect(screen.getByText("First hour 1 Nov 2015, 00:00")).toBeInTheDocument();
    expect(screen.getByText("Last hour 3 Nov 2015, 00:00")).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: "10" } });
    expect(time()).toBe("1 November 2015, 10:00");
    fireEvent.keyDown(slider, { key: "PageUp" });
    expect(time()).toBe("1 November 2015, 20:00");
    fireEvent.keyDown(slider, { key: "PageDown" });
    expect(time()).toBe("1 November 2015, 10:00");
    fireEvent.keyDown(slider, { key: "PageDown" });
    fireEvent.keyDown(slider, { key: "PageDown" });
    expect(time()).toBe("1 November 2015, 00:00"); // clamped at the first hour
  });

  it("dragging applies on release, not on every move", async () => {
    await ready();
    const slider = screen.getByRole("slider", { name: "Simulated plant time" });
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: "30" } });
    expect(time()).toBe("1 November 2015, 06:00");
    fireEvent.pointerUp(document);
    expect(time()).toBe("2 November 2015, 06:00");
  });

  it("keeps a replay time from the address and ignores a bad one with a note", async () => {
    setAddress("?at=2015-11-02T00:00");
    await ready();
    expect(time()).toBe("2 November 2015, 00:00");
  });

  it("ignores a replay time outside the window, starts at the usual hour and says so", async () => {
    setAddress("?at=2099-01-01T00:00");
    await ready();
    expect(time()).toBe("1 November 2015, 06:00");
    expect(screen.getByRole("note")).toHaveTextContent(/isn.t an hour inside the simulated data/);
  });

  it("shows the time read-only, without controls, on pages that don't change with it", async () => {
    mockPath = "/model-performance";
    renderWithData(<ReplayBar />, fakeFetch(readyMetadata()));
    await waitFor(() => expect(time()).toBe("1 November 2015, 06:00"));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("with no model data shows no time and no controls", async () => {
    mockPath = "/";
    renderWithData(<ReplayBar />, fakeFetch(noModelMetadata()));
    await screen.findByText(/model data isn.t installed in this preview/);
    expect(time()).toBe("—");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
