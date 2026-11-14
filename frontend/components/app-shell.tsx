"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { useData } from "@/components/data-provider";
import { ModelVersion } from "@/components/model-version";
import { ReplayBar } from "@/components/replay-bar";
import { Button } from "@/components/ui/button";
import { ABOUT_NAV, DISCLOSURE, MAIN_NAV, titleFor, type NavItem } from "@/lib/nav";
import { carriedSearch } from "@/lib/url-state";
import { cn } from "@/lib/utils";

function NavLink({ item, current, onNavigate }: { item: NavItem; current: boolean; onNavigate: () => void }) {
  // The replay time, cut-off and selected machine travel with the reader from page to page (decision 13).
  const { search } = useData();
  return (
    <Link
      href={`${item.href}${carriedSearch(search)}`}
      aria-current={current ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "on-dark flex min-h-11 items-center px-5 text-sm text-sidebar-text no-underline hover:bg-sidebar-active",
        current && "border-l-4 border-white bg-sidebar-active pl-4 font-semibold text-white",
      )}
    >
      {item.label}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null);
  const focusMainOnClose = useRef(false);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) menuButton.current?.focus();
  }, []);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (open) closeButton.current?.focus();
    else if (focusMainOnClose.current) {
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
      const focusable = panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
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
  const onNavigate = () => {
    if (open) focusMainOnClose.current = true;
    setOpen(false);
  };

  return (
    <div onKeyDown={onKeyDown}>
      <a
        href="#main"
        inert={open}
        className="absolute left-2 top-2 z-50 -translate-y-20 rounded-md bg-card px-3 py-2 text-sm font-semibold text-link focus:translate-y-0"
      >
        Skip to content
      </a>

      <div role="note" inert={open} className="bg-disclosure-bg px-4 py-2 text-[13px] leading-5 font-semibold text-disclosure-text">
        <span aria-hidden="true">ⓘ </span>
        {DISCLOSURE}
      </div>

      <div className="flex min-h-[calc(100vh-36px)]">
        {open && <div className="fixed inset-0 z-10 bg-black/45 lg:hidden" aria-hidden="true" onClick={() => close(true)} />}

        {/* While open (below 1024px only) this panel is a modal dialog: the rest of the page is inert. */}
        <div
          ref={panel}
          id="site-nav"
          role={open ? "dialog" : undefined}
          aria-modal={open ? true : undefined}
          aria-label={open ? "Main menu" : undefined}
          className={cn(
            "flex-col bg-sidebar py-4 text-sidebar-text lg:flex lg:w-60 lg:flex-none",
            open ? "fixed inset-y-0 left-0 z-20 flex w-70 overflow-y-auto" : "hidden",
          )}
        >
        <nav aria-label="Main" className="flex flex-1 flex-col">
          <div className="px-5 pb-4 text-lg font-bold text-white">PredictIQ</div>
          <Button
            ref={closeButton}
            variant="onDark"
            className="mx-5 mb-3 self-start lg:hidden"
            onClick={() => close(true)}
          >
            <X aria-hidden="true" size={16} /> Close menu
          </Button>
          <ul className="m-0 list-none p-0">
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <NavLink item={item} current={pathname === item.href} onNavigate={onNavigate} />
              </li>
            ))}
            <li aria-hidden="true" className="mx-5 my-2 border-t border-sidebar-active" />
            <li>
              <NavLink item={ABOUT_NAV} current={pathname === ABOUT_NAV.href} onNavigate={onNavigate} />
            </li>
          </ul>
          <div className="mt-auto px-5 pt-6 text-xs leading-4 text-sidebar-muted">
            Model version: <ModelVersion />
            <br />
            Data: Microsoft sample data (simulated), 2015
          </div>
        </nav>
        </div>

        <div inert={open} className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-14 flex-wrap items-center gap-3 border-b border-line bg-card px-3 py-2 sm:px-5">
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
            <span className="text-base font-bold lg:hidden">PredictIQ</span>
            <h1 className="order-3 m-0 basis-full text-xl leading-7 font-semibold lg:order-none lg:flex-1 lg:basis-auto lg:text-[22px]">
              {title}
            </h1>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-replay-bg px-2.5 py-0.5 text-xs font-semibold text-replay-text ring-1 ring-brand/40 lg:ml-0">
              <span aria-hidden="true">⏱</span> Historical replay
            </span>
          </header>

          <ReplayBar />

          <main ref={main} id="main" tabIndex={-1} className="flex max-w-[1440px] flex-col gap-4 p-3 sm:p-5">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
