"""Recompute WCAG 2.x contrast ratios for every pair listed in tokens.json.

Design-stage helper, not application code. Run: python3 -I docs/design/check-contrast.py
Prints a markdown table. Text pairs need 4.5:1 (normal text); "ui" pairs
(control edges, focus rings, chart marks) need 3:1. A pair may carry a 4th entry "forbidden":
it is reported but must never be used. Exit code 1 if a pair fails and is
not marked forbidden, or is marked forbidden but actually passes.
"""
import json
import pathlib
import sys

TOKENS = pathlib.Path(__file__).with_name("tokens.json")


def channel(c: float) -> float:
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_: str) -> float:
    h = hex_.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def ratio(a: str, b: str) -> float:
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def lookup(colors: dict, path: str) -> str:
    group, name = path.split(".", 1)
    return colors[group][name]


def main() -> int:
    data = json.loads(TOKENS.read_text())
    colors = data["color"]
    failures = 0
    print("| Foreground | Background | Ratio | Needs | Result |")
    print("|---|---|---:|---:|---|")
    for fg, bg, kind, *flag in data["contrast-pairs"]:
        forbidden = flag == ["forbidden"]
        need = 4.5 if kind == "text" else 3.0
        r = ratio(lookup(colors, fg), lookup(colors, bg))
        ok = r >= need
        failures += ok == forbidden
        label = "Forbidden" if forbidden else ("Pass" if ok else "**FAIL**")
        print(
            f"| `{fg}` {lookup(colors, fg)} | `{bg}` {lookup(colors, bg)} "
            f"| {r:.2f} | {need} | {label} |"
        )
    print(f"\n{failures} unexpected result(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
