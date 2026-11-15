import type { Page } from "@playwright/test";

// Colour maths used inside the page: contrast.spec.ts and the exact focus rule in keyboard.spec.ts.
// Installed once per page as window.__piq. It walks ancestors to the first opaque background, compositing
// semi-transparent backgrounds and element opacity on the way. Limits: background images and gradients are not sampled.
export const COLOUR_JS = `(() => {
  if (window.__piq) return;
  const parse = (s) => {
    if (!s || s === "transparent") return [0, 0, 0, 0];
    let m = s.match(/^rgba?\\(([^)]+)\\)$/);
    if (m) {
      const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    }
    m = s.match(/^color\\(srgb ([^)]+)\\)$/);
    if (m) {
      const p = m[1].split(/[ \\/]+/).filter(Boolean).map(Number);
      return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1];
    }
    throw new Error("unparsed colour " + s);
  };
  const over = (top, under) => {
    const a = top[3] + under[3] * (1 - top[3]);
    if (a === 0) return [0, 0, 0, 0];
    const c = (i) => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a;
    return [c(0), c(1), c(2), a];
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c) => "#" + [0, 1, 2].map((i) => Math.round(c[i]).toString(16).padStart(2, "0")).join("");
  // Effective opaque background BEHIND el's own box (el's own background is not included). Opacity of each ancestor
  // is applied to that ancestor's background.
  const behind = (el) => {
    const chain = [];
    for (let n = el.parentElement; n; n = n.parentElement) chain.push(n);
    let acc = [255, 255, 255, 1]; // the canvas
    for (let i = chain.length - 1; i >= 0; i--) {
      const cs = getComputedStyle(chain[i]);
      let bg = parse(cs.backgroundColor);
      const op = parseFloat(cs.opacity);
      if (op < 1) bg = [bg[0], bg[1], bg[2], bg[3] * op];
      acc = over(bg, acc);
    }
    return acc;
  };
  const opacityOf = (el) => { let o = 1; for (let n = el; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };
  // The focus outline of the focused element, checked against the exact rule; returns a list of problems (empty = fine).
  const focusProblems = (el, rule) => {
    const cs = getComputedStyle(el);
    const out = [];
    if (cs.outlineStyle !== rule.style) out.push("outline-style " + cs.outlineStyle);
    if (cs.outlineWidth !== rule.width) out.push("outline-width " + cs.outlineWidth);
    if (cs.outlineOffset !== rule.offset) out.push("outline-offset " + cs.outlineOffset);
    const col = parse(cs.outlineColor);
    const h = hex(col);
    const want = el.closest(".on-dark") ? rule.dark : rule.light;
    if (col[3] !== 1 || h !== want) out.push("outline-colour " + h + " (want " + want + ")");
    const r = ratio(col, behind(el));
    if (r < 3) out.push("focus outline contrast " + r.toFixed(2) + ":1 against " + hex(behind(el)));
    return out;
  };
  window.__piq = { parse, over, ratio, hex, behind, opacityOf, focusProblems };
})()`;

export async function installColourHelpers(page: Page) {
  await page.evaluate(COLOUR_JS);
}

/** The exact focus rule. docs/ux-spec.md, Accessibility: "a visible 2px outline on every control". docs/design/components.md:
 *  "Visible 2px focus outline with a 2px gap". tokens.md: brand.focus-ring #E84A37; on the dark sidebar
 *  sidebar.focus-ring #60A5FA. Both need 3:1 against what is next to them (the background behind the control). */
export const FOCUS_RING = { width: "2px", offset: "2px", style: "solid", light: "#e84a37", dark: "#f5a092" } as const;
