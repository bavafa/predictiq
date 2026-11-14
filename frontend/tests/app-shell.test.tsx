import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell";
import { DISCLOSURE } from "@/lib/nav";

let mockPath = "/";
vi.mock("next/navigation", () => ({ usePathname: () => mockPath }));

function mockMetadata(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) }),
  );
}

beforeEach(() => {
  mockPath = "/";
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
  mockMetadata({ app_name: "PredictIQ", version: "0.1.0", model_version: null, model_available: false });
});

afterEach(() => vi.unstubAllGlobals());

describe("AppShell", () => {
  it("shows the disclosure banner and the Historical replay badge, with no replay controls", () => {
    render(<AppShell>content</AppShell>);
    expect(screen.getByRole("note")).toHaveTextContent(DISCLOSURE);
    expect(screen.getByText("Historical replay")).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /play|step|start/i })).not.toBeInTheDocument();
  });

  it("lists the five pages as links and marks the current one", () => {
    mockPath = "/model-performance";
    render(<AppShell>content</AppShell>);
    const nav = screen.getByRole("navigation", { name: "Main" });
    const links = Array.from(nav.querySelectorAll("a")).map((a) => a.textContent);
    expect(links).toEqual([
      "Fleet Overview",
      "Asset Details",
      "Maintenance Planner",
      "Model Performance",
      "About & Data",
    ]);
    expect(screen.getByRole("link", { name: "Model Performance" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Model Performance");
  });

  it("shows 'none yet' when metadata reports no model", async () => {
    render(<AppShell>content</AppShell>);
    await waitFor(() => expect(screen.getByTestId("model-version")).toHaveTextContent("none yet"));
  });

  it("says the version could not be loaded when the data service is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<AppShell>content</AppShell>);
    await waitFor(() => expect(screen.getByTestId("model-version")).toHaveTextContent("couldn't load"));
  });

  it("opens the menu, moves focus inside, and closes on Escape returning focus to the button", async () => {
    const user = userEvent.setup();
    render(<AppShell>content</AppShell>);
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
    render(<AppShell>content</AppShell>);
    const menu = screen.getByRole("button", { name: /^Menu$/ });
    await user.click(menu);
    await user.click(screen.getByRole("button", { name: /Close menu/ }));
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveFocus();
  });

  it("keeps Tab focus inside the open menu", async () => {
    const user = userEvent.setup();
    render(<AppShell>content</AppShell>);
    await user.click(screen.getByRole("button", { name: /^Menu$/ }));
    const nav = screen.getByRole("navigation", { name: "Main" });
    for (let i = 0; i < 12; i++) {
      await user.tab();
      expect(nav.contains(document.activeElement)).toBe(true);
    }
  });

  it("is a labelled modal dialog while open, with the rest of the page inert, and plain navigation when closed", async () => {
    const user = userEvent.setup();
    const { container } = render(<AppShell>content</AppShell>);
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
