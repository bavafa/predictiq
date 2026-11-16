import { expect, test, type Page } from "@playwright/test";

import { FOCUS_RING, installColourHelpers } from "./colour-support";
import { INTERACTIVE, PAGES, VIEWPORTS, openPage } from "./page-support";

// WCAG 2.2 SC 1.4.11 Non-text Contrast (3:1), measured on the RENDERED pages, desktop and mobile, all five pages.
//  1. Every visible interactive control: its visible boundary (a border; or, with no border, its own background) against
//     the effective background behind it. The effective background is found by walking up to the first opaque
//     background, compositing translucent backgrounds and element opacity on the way.
//  2. The focus indicator of every one of those controls when it has keyboard focus: the exact ux-spec rule (2px solid,
//     2px offset, focus-ring token colour) and at least 3:1 against the background next to it.
//  3. Chart marks that carry meaning (lines, bars, markers, reference lines, legend keys) against the chart background.
// What this does NOT cover is written in docs/QA_REPORTS/stage5-testing.md (text contrast is axe's color-contrast rule, see
// axe-all.spec.ts; background images and gradients are not sampled; browser-drawn parts of native controls are not either).

type RGBA = [number, number, number, number];
type Piq = {
  parse: (s: string) => RGBA;
  over: (a: RGBA, b: RGBA) => RGBA;
  ratio: (a: RGBA, b: RGBA) => number;
  hex: (c: RGBA) => string;
  behind: (el: Element) => RGBA;
  opacityOf: (el: Element) => number;
  focusProblems: (el: Element, rule: unknown) => string[];
};

type Report = { checked: number; textOnly: number; native: number; inactive: number; failures: string[] };

async function controlBoundaries(page: Page): Promise<Report> {
  await installColourHelpers(page);
  return page.evaluate((selector) => {
    const q = (window as unknown as { __piq: Piq }).__piq;
    const rep: Report = { checked: 0, textOnly: 0, native: 0, inactive: 0, failures: [] };
    const label = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} "${(el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40)}"`;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      if (el.closest("[inert]")) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || el.getClientRects().length === 0) continue;
      // WCAG 1.4.11 exempts inactive components (disabled, or aria-disabled="true").
      if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") {
        rep.inactive++;
        continue;
      }
      const behind = q.behind(el);
      if (el instanceof HTMLInputElement && ["range", "checkbox", "radio"].includes(el.type)) {
        // Native controls are styled from tokens (globals.css), so each visible part is read from computed styles and held
        // to 3:1: the accent colour; for a range its track and thumb (pseudo-elements); for a checkbox or radio its border
        // (the normal boundary check below) and, when on, its fill. No blanket exemption.
        rep.native++;
        const part = (what: string, raw: string) => {
          const c = q.parse(raw);
          if (c[3] === 0) {
            rep.failures.push(`${label(el)}: ${what} has no measurable colour (${raw})`);
            return;
          }
          const r = q.ratio(q.over(c, behind), behind);
          if (r < 3) rep.failures.push(`${label(el)}: ${what} ${q.hex(q.over(c, behind))} on ${q.hex(behind)} is ${r.toFixed(2)}:1`);
        };
        part("accent-color", cs.accentColor);
        if (el.type === "range") {
          // Chromium does not return computed styles for slider pseudo-elements (always transparent), so the track and
          // thumb colours are read from the DECLARED rules in the loaded stylesheet and resolved through the token
          // variables. This measures what the stylesheet says, not painted pixels (see stage5-testing.md).
          const declared = (pseudo: string): string => {
            const walk = (rules: CSSRuleList): string => {
              let found = "";
              for (const rule of Array.from(rules)) {
                const r = rule as CSSStyleRule & { cssRules?: CSSRuleList };
                if (r.selectorText && r.selectorText.includes(pseudo) && r.selectorText.includes('input[type="range"]')) {
                  const v = r.style.getPropertyValue("background-color") || r.style.getPropertyValue("background");
                  if (v) found = v;
                } else if (r.cssRules) found = walk(r.cssRules) || found;
              }
              return found;
            };
            let value = "";
            for (const sheet of Array.from(document.styleSheets)) {
              try {
                value = walk(sheet.cssRules) || value;
              } catch {
                /* cross-origin sheet: none here */
              }
            }
            if (!value) return "rgba(0, 0, 0, 0)";
            const probe = document.createElement("span");
            probe.style.color = value;
            document.documentElement.appendChild(probe);
            const resolved = getComputedStyle(probe).color;
            probe.remove();
            return resolved;
          };
          part("track (declared)", declared("::-webkit-slider-runnable-track"));
          part("thumb (declared)", declared("::-webkit-slider-thumb"));
          continue;
        }
        if (el.checked) part("checked fill", cs.backgroundColor);
      }
      const own = q.over(q.parse(cs.backgroundColor), behind);
      const sides = ["Top", "Right", "Bottom", "Left"] as const;
      const border = sides
        .map((s) => ({ w: parseFloat(cs[`border${s}Width` as "borderTopWidth"]), st: cs[`border${s}Style` as "borderTopStyle"], c: q.parse(cs[`border${s}Color` as "borderTopColor"]) }))
        .find((b) => b.w > 0 && b.st !== "none" && b.c[3] > 0);
      const op = q.opacityOf(el);
      let edge: RGBA | null = null;
      let kind = "";
      if (border) {
        edge = q.over([border.c[0], border.c[1], border.c[2], border.c[3] * op], behind);
        kind = "border";
      } else if (q.parse(cs.backgroundColor)[3] > 0 && q.ratio(own, behind) >= 1.05) {
        edge = q.over([own[0], own[1], own[2], op], behind);
        kind = "background";
      }
      if (!edge) {
        rep.textOnly++; // no boundary drawn: the control is identified by its text, which axe's color-contrast checks
        continue;
      }
      rep.checked++;
      const r = q.ratio(edge, behind);
      if (r < 3) rep.failures.push(`${label(el)}: ${kind} ${q.hex(edge)} on ${q.hex(behind)} is ${r.toFixed(2)}:1`);
    }
    return rep;
  }, INTERACTIVE);
}

async function focusIndicators(page: Page): Promise<{ checked: number; failures: string[] }> {
  await installColourHelpers(page);
  // A key press first, so that :focus-visible applies to the focus() calls below, as it does for a keyboard user.
  await page.keyboard.press("Shift");
  return page.evaluate(
    ({ selector, rule }) => {
      const q = (window as unknown as { __piq: Piq }).__piq;
      const out = { checked: 0, failures: [] as string[] };
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        if (el.closest("[inert]") || (el as HTMLButtonElement).disabled) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || el.getClientRects().length === 0) continue;
        el.focus({ preventScroll: true });
        if (document.activeElement !== el) continue;
        out.checked++;
        const problems = q.focusProblems(el, rule);
        if (problems.length) {
          const name = (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
          out.failures.push(`${el.tagName.toLowerCase()} "${name}": ${problems.join(", ")}`);
        }
        el.blur();
      }
      return out;
    },
    { selector: INTERACTIVE, rule: FOCUS_RING },
  );
}

type Marks = { checked: number; failures: string[]; kinds: string[] };

async function chartMarks(page: Page): Promise<Marks> {
  await installColourHelpers(page);
  return page.evaluate(() => {
    const q = (window as unknown as { __piq: Piq }).__piq;
    const out: Marks = { checked: 0, failures: [], kinds: [] };
    const skip = ".recharts-cartesian-grid, .recharts-cartesian-axis, .recharts-polar-grid, clipPath, defs, .recharts-tooltip-cursor, .recharts-curve.recharts-tooltip-cursor";
    for (const svg of Array.from(document.querySelectorAll("svg.recharts-surface"))) {
      const chartBg = q.over(q.parse(getComputedStyle(svg).backgroundColor), q.behind(svg));
      for (const el of Array.from(svg.querySelectorAll("path, line, rect, circle, polygon"))) {
        if (el.closest(skip)) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        const box = (el as SVGGraphicsElement).getBBox?.();
        if (box && box.width === 0 && box.height === 0) continue;
        const where = `${(el.closest("[data-testid]") as HTMLElement | null)?.dataset.testid ?? "chart"} ${el.tagName}.${(el.getAttribute("class") ?? "").split(" ")[0]}`;
        const marks: [string, string][] = [];
        if (cs.stroke !== "none" && parseFloat(cs.strokeWidth) > 0) marks.push(["stroke", cs.stroke]);
        if (cs.fill !== "none") marks.push(["fill", cs.fill]);
        for (const [what, raw] of marks) {
          let c = q.parse(raw);
          const a = c[3] * parseFloat(what === "stroke" ? cs.strokeOpacity : cs.fillOpacity) * q.opacityOf(el);
          if (a === 0) continue;
          c = q.over([c[0], c[1], c[2], a], chartBg);
          const r = q.ratio(c, chartBg);
          // A fill the same colour as the chart surface is the plot background, not a mark.
          if (what === "fill" && r < 1.05) continue;
          out.checked++;
          if (!out.kinds.includes(`${where} ${what}`)) out.kinds.push(`${where} ${what}`);
          if (r < 3) out.failures.push(`${where} ${what} ${q.hex(c)} on ${q.hex(chartBg)} is ${r.toFixed(2)}:1`);
        }
      }
    }
    return out;
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`rendered non-text contrast (${vp.name})`, () => {
    for (const def of PAGES) {
      test(`${def.name}: control boundaries are at least 3:1 against the background behind them`, async ({ page }) => {
        await openPage(page, def, vp.width, vp.height);
        const rep = await controlBoundaries(page);
        // Guard: the walk must really have looked at controls, or an empty result would pass for the wrong reason.
        expect(rep.checked + rep.textOnly + rep.native, "controls found").toBeGreaterThanOrEqual(3);
        test.info().annotations.push({ type: "controls", description: `${rep.checked} with a boundary, ${rep.textOnly} text-only, ${rep.native} native, ${rep.inactive} inactive (exempt)` });
        expect(rep.failures).toEqual([]);
      });

      test(`${def.name}: every control's keyboard focus outline is the exact rule and at least 3:1`, async ({ page }) => {
        await openPage(page, def, vp.width, vp.height);
        const rep = await focusIndicators(page);
        expect(rep.checked, "controls focused").toBeGreaterThanOrEqual(3);
        expect(rep.failures).toEqual([]);
      });
    }

    for (const def of [PAGES[0]!, PAGES[1]!, PAGES[3]!]) {
      test(`${def.name}: chart marks are at least 3:1 against the chart background`, async ({ page }) => {
        await openPage(page, def, vp.width, vp.height);
        const rep = await chartMarks(page);
        expect(rep.checked, "chart marks found").toBeGreaterThanOrEqual(3);
        test.info().annotations.push({ type: "marks", description: rep.kinds.join("; ") });
        expect(rep.failures).toEqual([]);
      });

    }
  });
}

// Rendered TEXT contrast (WCAG 1.4.3), independent of axe, over every visible text element on all five pages. It exists
// because axe's color-contrast reports some nodes as "incomplete" (cannot decide): SVG chart text (<tspan>) and text it
// thinks is "partially obscured", for example table cells. axe-all.spec.ts accepts only those kinds of undecided node,
// and only because this test measures them. Large text (24px, or 18.66px bold) needs 3:1, other text 4.5:1.
for (const vp of VIEWPORTS) {
  for (const def of PAGES) {
    test(`rendered text contrast: ${def.name} (${vp.name})`, async ({ page }) => {
      await openPage(page, def, vp.width, vp.height);
      await installColourHelpers(page);
      const rep = await page.evaluate(() => {
        const q = (window as unknown as { __piq: Piq }).__piq;
        const out = { checked: 0, svg: 0, failures: [] as string[] };
        const hasOwnText = (el: Element) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "");
        for (const el of Array.from(document.body.querySelectorAll("*"))) {
          if (!hasOwnText(el) || el.closest("script, style, noscript, defs, clipPath")) continue;
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          const r0 = el.getBoundingClientRect();
          if (r0.width <= 1 || r0.height <= 1) continue; // visually hidden (screen reader only)
          if (el.closest('[disabled], [aria-disabled="true"]')) continue; // inactive components are exempt (WCAG 1.4.3)
          const isSvg = el instanceof SVGElement;
          const own = q.parse(cs.backgroundColor);
          const op = q.opacityOf(el);
          const bg = q.over([own[0], own[1], own[2], own[3] * parseFloat(cs.opacity)], q.behind(el));
          const c = q.parse(isSvg ? cs.fill : cs.color);
          const a = c[3] * (isSvg ? parseFloat(cs.fillOpacity) : 1) * op;
          const fg = q.over([c[0], c[1], c[2], a], bg);
          const size = parseFloat(cs.fontSize);
          const large = size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
          const need = large ? 3 : 4.5;
          out.checked++;
          if (isSvg) out.svg++;
          const r = q.ratio(fg, bg);
          if (r < need) {
            const words = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
            out.failures.push(`<${el.tagName.toLowerCase()}> "${words}" ${q.hex(fg)} on ${q.hex(bg)} is ${r.toFixed(2)}:1, needs ${need} (${cs.fontSize})`);
          }
        }
        return out;
      });
      expect(rep.checked, "text elements checked").toBeGreaterThan(10);
      if (["Overview", "Asset page", "Alert accuracy"].includes(def.name)) expect(rep.svg, "chart text checked").toBeGreaterThan(0);
      expect(rep.failures).toEqual([]);
    });
  }
}
