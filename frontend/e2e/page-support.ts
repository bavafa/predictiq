import { expect, type Page } from "@playwright/test";

// Shared by the Stage 5 accessibility specs (target size, keyboard, axe, notice): the five pages, how to tell
// each one has finished loading, and the two viewports the specs use.

export const DISCLOSURE = "Portfolio demo — simulated historical sample data; estimated economics are illustrative.";

export const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
] as const;

export type PageDef = { name: string; path: string; heading: string; ready: (page: Page) => Promise<void> };

export const PAGES: PageDef[] = [
  {
    name: "Assets",
    path: "/assets",
    heading: "Assets",
    ready: async (page) => {
      await expect(page.getByTestId("card-shown")).toBeVisible();
      await expect(page.getByTestId("risk-chart")).toBeVisible();
    },
  },
  {
    name: "Asset page",
    path: "/asset-details?machine=1",
    heading: "Asset page",
    ready: async (page) => {
      await expect(page.getByTestId("asset-score")).toBeVisible();
      await expect(page.getByTestId("explanation-table")).toBeVisible();
      await expect(page.getByTestId("sensor-volt")).toBeVisible();
    },
  },
  {
    name: "Work plan",
    path: "/maintenance-planner?cutoff=5",
    heading: "Work plan",
    ready: async (page) => {
      await expect(page.getByTestId("planner-ready")).toBeVisible();
      await expect(page.getByTestId("planner-ready")).not.toHaveAttribute("aria-busy", "true");
    },
  },
  {
    name: "Alert accuracy",
    path: "/model-performance",
    heading: "Alert accuracy",
    ready: async (page) => {
      await expect(page.getByTestId("comparison-table")).toBeVisible();
      await expect(page.getByTestId("mp-charts")).toBeVisible();
    },
  },
  {
    name: "In a real plant",
    path: "/real-plant",
    heading: "In a real plant",
    ready: async () => {},
  },
  {
    name: "About this demo",
    path: "/about-data",
    heading: "About this demo",
    ready: async () => {},
  },
  // Added last so the index-based picks above keep their pages (stage 2 of the redesign).
  {
    name: "Home",
    path: "/",
    heading: "Home",
    ready: async (page) => {
      await expect(page.getByTestId("overview-headline")).toBeVisible();
    },
  },
  {
    name: "Alerts",
    path: "/alerts",
    heading: "Alerts",
    ready: async (page) => {
      await expect(page.getByTestId("overview-headline")).toBeVisible();
    },
  },
];

export async function openPage(page: Page, def: PageDef, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto(def.path);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(def.heading);
  await def.ready(page);
}

/** What a keyboard user can reach, and what a touch user can press: used by the keyboard and target-size specs. */
export const INTERACTIVE =
  'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="slider"], [tabindex]:not([tabindex="-1"])';

// Target size helper (rule and sources are in target-size.spec.ts).
const MIN = 44;

export type Small = { what: string; width: number; height: number };

/** Every visible interactive element smaller than 44 x 44 CSS px. Runs inside the page. */
export async function tooSmall(page: Page): Promise<Small[]> {
  return page.evaluate(
    ({ selector, min }) => {
      const out: { what: string; width: number; height: number }[] = [];
      const nameOf = (el: Element) => {
        const text = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 50);
        return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} "${text}"`;
      };
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        if (el.closest("[inert]")) continue;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        let box: Element = el;
        if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
          box = el.closest("label") ?? (el.id ? document.querySelector(`label[for="${el.id}"]`) : null) ?? el;
        }
        const r = box.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue; // not rendered
        if (r.width < min - 0.01 || r.height < min - 0.01) {
          out.push({ what: nameOf(el), width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10 });
        }
      }
      return out;
    },
    { selector: INTERACTIVE, min: MIN },
  );
}

export const fmt = (list: Small[]) => list.map((s) => `${s.what} ${s.width}x${s.height}`).join(" | ");
