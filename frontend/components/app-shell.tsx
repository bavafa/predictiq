"use client";

import { Gauge, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/** "Show data labels" (redesign decision 82): value tags are visually hidden by default but stay in accessible names. */
function DataLabelsSwitch() {
  const [on, setOn] = useStoredFlag("piq-data-labels");
  useEffect(() => {
    document.documentElement.dataset.labels = on ? "on" : "off";
  }, [on]);
  function toggle() {
    setOn(!on);
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-semibold text-ink lg:ml-0"
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative h-5 w-9 rounded-full border border-input-edge",
          on ? "bg-brand" : "bg-subtle",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3.5 w-3.5 rounded-full border border-input-edge bg-card",
            on ? "left-4" : "left-0.5",
          )}
        />
      </span>
      Show data labels
    </button>
  );
}

import { useData } from "@/components/data-provider";
import { ModelVersion } from "@/components/model-version";
import { ReplayBar } from "@/components/replay-bar";
import { Button } from "@/components/ui/button";
import { DISCLOSURE, INFO_NAV, MAIN_NAV, titleFor, type NavItem } from "@/lib/nav";
import { useStoredFlag } from "@/lib/stored-flag";
import type { Fleet } from "@/lib/types";
import { carriedSearch } from "@/lib/url-state";
import { useApiQuery } from "@/lib/use-api-query";
import { cn } from "@/lib/utils";

function NavLink({
  item,
  current,
  onNavigate,
  count,
}: {
  item: NavItem;
  current: boolean;
  onNavigate: () => void;
  count: number | null;
}) {
  // The simulated plant time, cut-off and selected machine travel with the reader from page to page (decision 13).
  const { search } = useData();
  const desktop = useDesktop();
  return (
    <Link
      href={`${item.href}${carriedSearch(search)}`}
      aria-current={current ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        // Light text on the dark menu panel (below 1024px); dark text on the white top bar (1024px and up).
        !desktop && "on-dark",
        "flex min-h-11 items-center gap-2 px-5 text-sm text-sidebar-text no-underline hover:bg-sidebar-active",
        "lg:min-h-14 lg:border-b-4 lg:border-transparent lg:px-3 lg:text-[15px] lg:text-ink lg:hover:bg-subtle",
        current &&
          "border-l-4 border-white bg-sidebar-active pl-4 font-semibold text-white lg:border-l-0 lg:border-b-brand lg:bg-transparent lg:pl-3 lg:text-ink",
      )}
    >
      {item.label}
      {count !== null && count > 0 && (
        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-alert-bg px-1.5 text-xs leading-5 font-bold text-alert-text ring-1 ring-alert-edge">
          <span aria-hidden="true">{count}</span>
          <span className="sr-only">, {count} act today</span>
        </span>
      )}
    </Link>
  );
}

const DESKTOP = "(min-width: 1024px)";
const subscribeDesktop = (cb: () => void) => {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
/** True from 1024px: the navigation is the top bar, not the menu panel. False on the server and while unknown. */
function useDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
}

/** The number of machines that need action at the simulated plant time (the badge on Alerts); null until known. */
function useAlertCount(): number | null {
  const { client, meta, view } = useData();
  const version = meta.status === "ready" ? meta.meta.model_version : "";
  const q = useApiQuery<Fleet>(
    (signal) =>
      view
        ? client.fleet({ at: view.at, cutoff: view.cutoff }, { signal })
        : Promise.reject(new Error("no view")),
    [client, version, view?.at, view?.cutoff],
  );
  return q.status === "ready"
    ? q.data.rows.filter((r) => r.status === "alert").length
    : null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { search, meta } = useData();
  const alertCount = useAlertCount();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null);
  const focusMainOnClose = useRef(false);
  const focusMenuOnClose = useRef(false);

  const close = useCallback((restoreFocus: boolean) => {
    // The page is inert while the panel is open, so focus goes back only after the close has rendered.
    if (restoreFocus) focusMenuOnClose.current = true;
    setOpen(false);
  }, []);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (open) closeButton.current?.focus();
    else if (focusMenuOnClose.current) {
      focusMenuOnClose.current = false;
      menuButton.current?.focus();
    } else if (focusMainOnClose.current) {
      // After a menu link is used the page content is no longer inert: move focus to it.
      focusMainOnClose.current = false;
      main.current?.focus();
    }
  }, [open]);

  // The panel only exists as a panel below 1024px; if the window grows, reset.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key === "Tab" && panel.current) {
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  const title = titleFor(pathname);
  const home = pathname === "/";
  const Title = home ? "p" : "h1"; // the hero carries the h1 on Home
  const onNavigate = () => {
    if (open) focusMainOnClose.current = true;
    setOpen(false);
  };

  return (
    <div onKeyDown={onKeyDown}>
      <a
        href="#main"
        inert={open}
        className="absolute left-2 top-2 z-50 inline-flex min-h-11 min-w-11 -translate-y-20 items-center rounded-md border border-input-edge bg-card px-3 text-sm font-semibold text-link focus:translate-y-0"
      >
        Skip to content
      </a>

      {open && (
        <div
          className="fixed inset-0 z-10 bg-black/45 lg:hidden"
          aria-hidden="true"
          onClick={() => close(true)}
        />
      )}

      {/* Below 1024px this is the menu panel (a modal dialog while open: the rest of the page is inert). From 1024px
          it is the top navigation bar (v2 spec, stage 1). */}
      <div
        ref={panel}
        id="site-nav"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? "Main menu" : undefined}
        className={cn(
          "flex-col bg-sidebar py-4 text-sidebar-text lg:flex lg:flex-row lg:items-center lg:border-b lg:border-line lg:bg-card lg:px-6 lg:py-0 lg:text-ink",
          open
            ? "fixed inset-y-0 left-0 z-20 flex w-70 overflow-y-auto lg:static lg:w-auto lg:overflow-visible"
            : "hidden",
        )}
      >
        <nav
          aria-label="Main"
          className="flex flex-1 flex-col lg:flex-row lg:items-center lg:gap-8"
        >
          <div className="flex items-center gap-2.5 px-5 pb-4 text-white lg:px-0 lg:py-3 lg:text-ink">
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-lg bg-brand text-white"
            >
              <Gauge size={18} />
            </span>
            <div className="text-lg font-bold lg:text-xl">PredictIQ</div>
          </div>
          <Button
            ref={closeButton}
            variant="onDark"
            className="mx-5 mb-3 self-start lg:hidden"
            onClick={() => close(true)}
          >
            <X aria-hidden="true" size={16} /> Close menu
          </Button>
          <ul className="m-0 flex list-none flex-col p-0 lg:flex-1 lg:flex-row lg:items-stretch lg:gap-1">
            {MAIN_NAV.map((item) => (
              <li key={item.href} className="lg:flex">
                <NavLink
                  item={item}
                  current={pathname === item.href}
                  onNavigate={onNavigate}
                  count={item.href === "/alerts" ? alertCount : null}
                />
              </li>
            ))}
            <li
              aria-hidden="true"
              className="mx-5 my-2 border-t border-sidebar-active lg:hidden"
            />
            {INFO_NAV.map((item) => (
              <li key={item.href} className="lg:ml-auto lg:flex">
                <NavLink
                  item={item}
                  current={pathname === item.href}
                  onNavigate={onNavigate}
                  count={null}
                />
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div inert={open} className="flex min-w-0 flex-col">
        <header
          className={cn(
            "border-b border-line bg-card px-3 py-2 sm:px-5 lg:px-6",
            home && "lg:hidden",
          )}
        >
          <div className="mx-auto flex min-h-10 w-full max-w-[1200px] flex-wrap items-center gap-3">
            <Button
              ref={menuButton}
              variant="outline"
              className="lg:hidden"
              aria-expanded={open}
              aria-controls="site-nav"
              onClick={() => setOpen(true)}
            >
              <Menu aria-hidden="true" size={16} /> Menu
            </Button>
            <span className="text-base font-bold lg:hidden">
              PredictIQ · Demo plant
            </span>
            <Title className="order-3 m-0 basis-full text-xl leading-7 font-semibold lg:order-none lg:flex-1 lg:basis-auto lg:text-[22px]">
              {title}
            </Title>
            <DataLabelsSwitch />
            <ReplayBar />
          </div>
        </header>

        <main
          ref={main}
          id="main"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 p-3 sm:p-5 lg:px-6"
        >
          {home && meta.status !== "ready" && <h1 className="sr-only">Home</h1>}
          {children}
        </main>

        <footer className="mt-auto border-t border-line bg-card px-3 py-4 text-sm text-ink-2 sm:px-5 lg:px-6">
          <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-x-4">
            <p className="m-0">{DISCLOSURE}</p>
            <span>
              <Link
                href={`/about-data${carriedSearch(search)}`}
                className="inline-flex min-h-11 items-center underline"
              >
                About this demo
              </Link>
              <span aria-hidden="true"> · </span>
              <Link
                href={`/real-plant${carriedSearch(search)}`}
                className="inline-flex min-h-11 items-center underline"
              >
                In a real plant
              </Link>
            </span>
          </div>
          <p className="m-0 mx-auto w-full max-w-[1200px] text-xs leading-4">
            Model version: <ModelVersion />. Data: Microsoft sample data
            (simulated), 2015.
          </p>
        </footer>
      </div>
    </div>
  );
}
