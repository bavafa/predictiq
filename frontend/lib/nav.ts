export type NavItem = { href: string; label: string };

export const DISCLOSURE = "Portfolio demo — historical sample data; estimated economics are illustrative.";

export const PROVENANCE_URL = "https://github.com/bavafa/predictiq/blob/main/docs/DATA_PROVENANCE.md";

export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Fleet Overview" },
  { href: "/asset-details", label: "Asset Details" },
  { href: "/maintenance-planner", label: "Maintenance Planner" },
  { href: "/model-performance", label: "Model Performance" },
];

export const ABOUT_NAV: NavItem = { href: "/about-data", label: "About & Data" };

export const ALL_NAV: NavItem[] = [...MAIN_NAV, ABOUT_NAV];

export function titleFor(pathname: string): string {
  return ALL_NAV.find((n) => n.href === pathname)?.label ?? "PredictIQ";
}
