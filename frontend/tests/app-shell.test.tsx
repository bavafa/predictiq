import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell";
import type { FetchLike } from "@/lib/api";
import { DISCLOSURE } from "@/lib/nav";
import { fakeFetch, noModelMetadata, readyMetadata, renderWithData } from "./helpers";

let mockPath = "/";
vi.mock("next/navigation", () => ({ usePathname: () => mockPath }));

let service: FetchLike = fakeFetch(noModelMetadata());
const renderShell = () => renderWithData(<AppShell>content</AppShell>, service);

beforeEach(() => {
  mockPath = "/";
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
  service = fakeFetch(noModelMetadata());
});

afterEach(() => window.history.replaceState(null, "", "/"));

describe("AppShell", () => {
  it("shows the disclosure banner and the Simulated plant time label, with no time controls when there is no model data", async () => {
    renderShell();
    expect(screen.getByRole("note")).toHaveTextContent(DISCLOSURE);
    expect(screen.getAllByText("Simulated plant time").length).toBeGreaterThan(0);
    await screen.findByText(/no time controls/);
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /play|step|start/i })).not.toBeInTheDocument();
  });

  it("carries the replay time and cut-off to the other pages' links, and not the filters", async () => {
    window.history.replaceState(null, "", "/?at=2015-11-02T00:00&cutoff=30&status=alert");
    service = fakeFetch(readyMetadata());
    renderShell();
    await screen.findByRole("button", { name: "Advance 1 h" }, { timeout: 10_000 });
    expect(screen.getByRole("link", { name: "Assets" })).toHaveAttribute(
      "href",
      "/assets?at=2015-11-02T00%3A00&cutoff=30",
    );
  });

  it("lists the six pages as links and marks the current one", () => {
    mockPath = "/model-performance";
    renderShell();
    const nav = screen.getByRole("navigation", { name: "Main" });
    const links = Array.from(nav.querySelectorAll("a")).map((a) => a.textContent);
    expect(links).toEqual([
      "Overview",
      "Assets",
      "Work plan",
      "Alert accuracy",
      "In a real plant",
      "About this demo",
    ]);
    expect(screen.getByRole("link", { name: "Alert accuracy" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Alert accuracy");
  });

  it("shows 'none yet' when metadata reports no model", async () => {
    renderShell();
    await waitFor(() => expect(screen.getByTestId("model-version")).toHaveTextContent("none yet"));
  });

  it("says the version could not be loaded when the data service is unreachable", async () => {
    service = vi.fn().mockRejectedValue(new TypeError("offline"));
    renderShell();
    await waitFor(() => expect(screen.getByTestId("model-version")).toHaveTextContent("couldn't load"));
  });

  it("opens the menu, moves focus inside, and closes on Escape returning focus to the button", async () => {
    const user = userEvent.setup();
    renderShell();
    const menu = screen.getByRole("button", { name: /^Menu$/ });
    expect(menu).toHaveAttribute("aria-expanded", "false");

    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Close menu/ })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveFocus();
  });

  it("closes the menu with the Close menu button", async () => {
    const user = userEvent.setup();
    renderShell();
    const menu = screen.getByRole("button", { name: /^Menu$/ });
    await user.click(menu);
    await user.click(screen.getByRole("button", { name: /Close menu/ }));
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveFocus();
  });

  it("moves focus to the main landmark when a menu link is activated", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole("button", { name: /^Menu$/ }));
    const link = screen.getByRole("link", { name: "Assets" });
    link.addEventListener("click", (e) => e.preventDefault());
    await user.click(link);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("keeps Tab focus inside the open menu", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole("button", { name: /^Menu$/ }));
    const nav = screen.getByRole("navigation", { name: "Main" });
    for (let i = 0; i < 12; i++) {
      await user.tab();
      expect(nav.contains(document.activeElement)).toBe(true);
    }
  });

  it("is a labelled modal dialog while open, with the rest of the page inert, and plain navigation when closed", async () => {
    const user = userEvent.setup();
    const { container } = renderShell();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(container.querySelectorAll("[inert]")).toHaveLength(0);

    const menu = screen.getByRole("button", { name: /^Menu$/ });
    await user.click(menu);
    const dialog = screen.getByRole("dialog", { name: "Main menu" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.querySelector("nav")).toBeInTheDocument();
    expect(menu.closest("[inert]")).not.toBeNull();
    expect(screen.getByRole("note").closest("[inert]")).not.toBeNull();
    expect(screen.getByText("content").closest("[inert]")).not.toBeNull();
    expect(dialog.closest("[inert]")).toBeNull();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(container.querySelectorAll("[inert]")).toHaveLength(0);
    expect(menu).toHaveFocus();
  });
});
