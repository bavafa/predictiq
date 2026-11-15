export type NavItem = { href: string; label: string };

export const DISCLOSURE = "Portfolio demo — simulated historical sample data; estimated economics are illustrative.";

export const PROVENANCE_URL = "https://github.com/bavafa/predictiq/blob/main/docs/DATA_PROVENANCE.md";

export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Fleet Overview" },
  { href: "/asset-details", label: "Asset Details" },
  { href: "/maintenance-planner", label: "Maintenance Planner" },
  { href: "/model-performance", label: "Model Performance" },
];

export const ABOUT_NAV: NavItem = { href: "/about-data", label: "About & Data" };

export const PLANT_NAV: NavItem = { href: "/real-plant", label: "In a Real Plant" };

/** The reading pages under the divider. */
export const INFO_NAV: NavItem[] = [PLANT_NAV, ABOUT_NAV];

export const ALL_NAV: NavItem[] = [...MAIN_NAV, ...INFO_NAV];

/** Pages that change with the replay time (full replay controls). The others show the time read-only. */
export const REPLAY_PAGES: readonly string[] = ["/", "/asset-details", "/maintenance-planner"];

export function titleFor(pathname: string): string {
  return ALL_NAV.find((n) => n.href === pathname)?.label ?? "PredictIQ";
}
