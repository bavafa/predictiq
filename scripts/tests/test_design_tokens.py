"""The design tokens are what ships.

docs/design/tokens.json is the source of truth. This test checks:
1. every contrast pair in tokens.json (4.5:1 for text, 3:1 for ui; "forbidden" pairs must really fail),
   using the same formula as docs/design/check-contrast.py (it is loaded, not copied);
2. every colour variable in frontend/app/globals.css equals the token it is named for;
3. the chart colour constants in the chart components equal their tokens;
4. no colour appears anywhere in the app source that is not a tokens.json value: 3/4/6/8-digit hex,
   rgb()/rgba()/hsl()/hsla()/hwb()/lab()/lch()/oklab()/oklch()/color()/color-mix(), CSS colour names, named
   Tailwind colour utilities (text-gray-500, bg-slate-100, border-black ...), opacity modifiers on colour
   utilities (bg-ink/50) and arbitrary values (text-[#abc], bg-[rgb(...)]). The only exception is listed, with
   its reason, in OFF_TOKEN_ALLOWED.

What this scan does and does not do: it reads source text. It does not see colours built at run time (string
concatenation), colours from node_modules (recharts defaults) or what the browser finally draws. The rendered
pages are checked by frontend/e2e/contrast.spec.ts and axe's color-contrast rule.
"""

from __future__ import annotations

import importlib.util
import json
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
TOKENS = json.loads((ROOT / "docs/design/tokens.json").read_text())
COLORS = TOKENS["color"]

_spec = importlib.util.spec_from_file_location("check_contrast", ROOT / "docs/design/check-contrast.py")
assert _spec and _spec.loader
check_contrast = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(check_contrast)


def token(path: str) -> str:
    group, name = path.split(".", 1)
    return str(COLORS[group][name]).lower()


# CSS variable in globals.css -> token path. Every --color-* variable must be listed here.
CSS_VARS = {
    "--color-sidebar": "sidebar.bg",
    "--color-sidebar-active": "sidebar.bg-active",
    "--color-sidebar-text": "sidebar.text",
    "--color-sidebar-muted": "sidebar.text-muted",
    "--color-sidebar-ring": "sidebar.focus-ring",
    "--color-page": "surface.background",
    "--color-card": "surface.card",
    "--color-subtle": "surface.subtle",
    "--color-line": "surface.border",
    "--color-input-edge": "surface.input-border",
    "--color-ink": "text.primary",
    "--color-ink-2": "text.secondary",
    "--color-ink-3": "text.muted",
    "--color-brand": "brand.primary",
    "--color-brand-hover": "brand.primary-hover",
    "--color-link": "brand.link",
    "--color-focus": "brand.focus-ring",
    "--color-disclosure-bg": "notice.disclosure-bg",
    "--color-disclosure-text": "notice.disclosure-text",
    "--color-replay-bg": "notice.replay-bg",
    "--color-replay-text": "notice.replay-text",
    "--color-alert-bg": "risk.alert-bg",
    "--color-alert-text": "risk.alert-text",
    "--color-alert-edge": "risk.alert-border",
}

# (file, constant name, token path) for colours written as constants in chart code.
CHART_CONSTS = [
    ("frontend/components/asset-charts.tsx", "SENSOR", "chart.sensor-line"),
    ("frontend/components/asset-charts.tsx", "RISK", "chart.risk-line"),
    ("frontend/components/asset-charts.tsx", "CUTOFF", "chart.cutoff-line"),
    ("frontend/components/asset-charts.tsx", "FAILURE", "chart.recorded-failure"),
    ("frontend/components/asset-charts.tsx", "REPAIR", "chart.maintenance-marker"),
    ("frontend/components/asset-charts.tsx", "ERROR", "chart.error-marker"),
    ("frontend/components/asset-charts.tsx", "INK2", "text.secondary"),
    ("frontend/components/asset-charts.tsx", "GRID", "chart.grid"),
    ("frontend/components/fleet-charts.tsx", "INK", "text.primary"),
    ("frontend/components/fleet-charts.tsx", "INK2", "text.secondary"),
    ("frontend/components/fleet-charts.tsx", "BAR", "chart.maintenance-marker"),
    ("frontend/components/fleet-charts.tsx", "LINE_EDGE", "chart.grid"),
    ("frontend/components/model-charts.tsx", "MAIN", "chart.model-main"),
    ("frontend/components/model-charts.tsx", "BASELINE", "chart.model-baseline"),
    ("frontend/components/model-charts.tsx", "CUTOFF", "chart.cutoff-line"),
    ("frontend/components/model-charts.tsx", "SLATE", "chart.maintenance-marker"),
    ("frontend/components/model-charts.tsx", "INK2", "text.secondary"),
    ("frontend/components/model-charts.tsx", "GRID", "chart.grid"),
]

SOURCE_DIRS = ["frontend/app", "frontend/components", "frontend/lib"]

# --- the source scan ----------------------------------------------------------------------------------------
# 3, 4, 6 and 8 digit hex (not a URL fragment or a word that merely starts with #).
HEX = re.compile(r"(?<![\w&/\-])#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b")
COLOUR_FUNC = re.compile(r"(?<![\w-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix|color)\(")
PALETTES = (
    "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|"
    "purple|fuchsia|pink|rose|taupe|mauve|mist|olive"
)
COLOUR_UTILS = (
    "text|bg|border|border-[trblxyse]|ring|ring-offset|outline|fill|stroke|from|via|to|divide|decoration|"
    "placeholder|accent|caret|shadow|inset-ring|inset-shadow"
)
# text-gray-500, bg-slate-100/50, hover:border-black, ...
TAILWIND_NAMED = re.compile(
    rf"(?<![\w-])(?:{COLOUR_UTILS})-(?:(?:{PALETTES})-\d{{2,3}}|black|white|transparent|current|inherit)(?:/\d+)?(?![\w-])"
)
# An opacity modifier on any colour utility changes the colour: bg-ink/50, text-white/70, bg-[var(--x)]/20.
OPACITY_MOD = re.compile(rf"(?<![\w-])(?:{COLOUR_UTILS})-(?:\[[^\]\s]+\]|[a-z][a-z0-9-]*)/\d+(?![\w-])")
# Arbitrary colour values: bg-[rgb(0,0,0)], border-[color:...]. (Hex inside [] is caught by the hex pattern.)
ARBITRARY = re.compile(rf"(?<![\w-])(?:{COLOUR_UTILS})-\[(?:color:|rgb|hsl|hwb|lab|lch|oklab|oklch)[^\]]*\]")
CSS_NAMES = (
    "black|silver|gray|grey|maroon|red|purple|fuchsia|green|lime|olive|yellow|navy|blue|teal|aqua|orange|pink|brown|"
    "gold|cyan|magenta|indigo|violet|crimson|coral|salmon|tomato|khaki|plum|tan|beige|ivory|lavender|white"
)
NAMED_VALUE = re.compile(
    rf"\b(?:color|background(?:-color)?|fill|stroke|border(?:-\w+)?-color|border-color|outline(?:-color)?|"
    rf"stopColor|stop-color|floodColor)\s*[:=]\s*\{{?\s*[\"']?(?:{CSS_NAMES})\b",
)

# JavaScript / TSX style objects and attributes: backgroundColor: "teal", fill: "hotpink", style.stroke = ...
# Any string value is a colour here unless it is a design-token variable or a non-colour keyword. Hex values
# are judged against the token list by the hex pattern, so they are skipped here.
JS_COLOUR_PROPS = (
    "color|backgroundColor|background|borderColor|border(?:Top|Right|Bottom|Left)Color|outlineColor|fill|stroke|"
    "stopColor|floodColor|caretColor|accentColor|textDecorationColor|lightingColor"
)
JS_STYLE_STRING = re.compile(rf"\b(?:{JS_COLOUR_PROPS})\s*(?::|=(?!=))\s*[{{(]?\s*([\"'`])([^\"'`\n]*)\1")
JS_STRING_OK = re.compile(
    r"^\s*(?:#[0-9a-fA-F]+|var\(--color-[a-z0-9-]+\)|none|transparent|currentColor|currentcolor|inherit|initial|unset|"
    r"white|auto|)\s*$"
)

# (file, text) pairs allowed although they are not tokens. Each needs a reason, and must still be present.
OFF_TOKEN_ALLOWED = {
    (
        "frontend/components/app-shell.tsx",
        "bg-black/45",
    ): "the dimming scrim behind the open mobile menu: a translucent overlay with no text and no information",
}


def all_token_values() -> set[str]:
    return {v.lower() for group in COLORS.values() for v in group.values()}


@pytest.mark.parametrize(
    "pair",
    TOKENS["contrast-pairs"],
    ids=lambda p: f"{p[0]} on {p[1]}" + (" (forbidden)" if len(p) > 3 else ""),
)
def test_contrast_pair(pair: list[str]) -> None:
    fg, bg, kind, *flag = pair
    need = 4.5 if kind == "text" else 3.0
    got = check_contrast.ratio(token(fg), token(bg))
    if flag == ["forbidden"]:
        assert got < need, f"{fg} on {bg} is {got:.2f}, which passes {need}: it should no longer be forbidden"
    else:
        assert got >= need, f"{fg} on {bg} is {got:.2f}, needs {need}"


def test_every_pair_uses_known_tokens() -> None:
    for fg, bg, *_ in TOKENS["contrast-pairs"]:
        token(fg), token(bg)  # KeyError if a path is wrong


def test_css_variables_equal_tokens() -> None:
    css = (ROOT / "frontend/app/globals.css").read_text()
    found = dict(re.findall(r"(--color-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;", css))
    assert set(found) == set(CSS_VARS), f"unmapped or missing colour variables: {set(found) ^ set(CSS_VARS)}"
    for var, path in CSS_VARS.items():
        assert found[var].lower() == token(path), f"{var} is {found[var]} but {path} is {token(path)}"


@pytest.mark.parametrize("file,const,path", CHART_CONSTS, ids=lambda v: str(v))
def test_chart_constants_equal_tokens(file: str, const: str, path: str) -> None:
    src = (ROOT / file).read_text()
    m = re.search(rf'^const {const} = "(#[0-9a-fA-F]{{6}})";', src, re.M)
    assert m, f"{file} has no colour constant {const}"
    assert m.group(1).lower() == token(path), f"{file} {const} is {m.group(1)} but {path} is {token(path)}"


def _scan_source() -> list[tuple[str, str, str]]:
    """Every colour-looking thing in the app source: (relative file, kind, text)."""
    allowed = all_token_values()
    found: list[tuple[str, str, str]] = []
    for d in SOURCE_DIRS:
        for f in sorted((ROOT / d).rglob("*")):
            if f.suffix not in {".ts", ".tsx", ".css"}:
                continue
            rel = str(f.relative_to(ROOT))
            text = f.read_text()
            for m in HEX.finditer(text):
                digits = m.group(1).lower()
                if len(digits) == 3:
                    digits = "".join(c * 2 for c in digits)
                if len(digits) in (4, 8) or "#" + digits not in allowed:
                    found.append((rel, "hex", m.group(0)))
            for m in COLOUR_FUNC.finditer(text):
                found.append((rel, "colour function", m.group(0)))
            for m in TAILWIND_NAMED.finditer(text):
                word = m.group(0)
                bare = word.split("/")[0]
                plain = bare.rsplit("-", 1)[-1]
                if "/" not in word and plain in {"transparent", "current", "inherit"}:
                    continue  # not a colour
                if "/" not in word and plain == "white" and "#ffffff" in allowed:
                    continue  # white is a token (text.on-primary, surface.card)
                found.append((rel, "named Tailwind colour", word))
            for m in OPACITY_MOD.finditer(text):
                found.append((rel, "opacity modifier", m.group(0)))
            for m in ARBITRARY.finditer(text):
                found.append((rel, "arbitrary colour", m.group(0)))
            for m in NAMED_VALUE.finditer(text):
                if not m.group(0).lower().rstrip("\"'").endswith("white"):
                    found.append((rel, "CSS colour name", m.group(0)))
            if f.suffix in {".ts", ".tsx"}:
                for m in JS_STYLE_STRING.finditer(text):
                    if not JS_STRING_OK.match(m.group(2)):
                        found.append((rel, "JS style colour string", m.group(0)))
    return found


def test_no_off_token_colour_in_app_source() -> None:
    found = _scan_source()
    stray = sorted(
        {f"{rel}: {kind} {text}" for rel, kind, text in found if (rel, text) not in OFF_TOKEN_ALLOWED}
    )
    assert stray == [], "colours in app source that are not in tokens.json:\n" + "\n".join(stray)
    # An allowance that no longer matches anything is stale: remove it.
    seen = {(rel, text) for rel, _, text in found}
    assert set(OFF_TOKEN_ALLOWED) <= seen, f"stale allowance: {set(OFF_TOKEN_ALLOWED) - seen}"


@pytest.mark.parametrize(
    "snippet,kind",
    [
        ('const c = "#abc";', "hex"),
        ('const c = "#ABCD";', "hex"),
        ('const c = "#12345678";', "hex"),
        ('style={{ color: "rgb(1, 2, 3)" }}', "colour function"),
        ("background: rgba(0 0 0 / 0.5);", "colour function"),
        ("color: hsl(10 20% 30%);", "colour function"),
        ('className="text-gray-500"', "named Tailwind colour"),
        ('className="hover:bg-slate-100"', "named Tailwind colour"),
        ('className="border-black"', "named Tailwind colour"),
        ('className="bg-ink/50"', "opacity modifier"),
        ('className="text-[#123]"', "hex"),
        ('className="text-[color:var(--x)]"', "arbitrary colour"),
        ('className="bg-[rgb(1,2,3)]"', "arbitrary colour"),
        ('const s = { fill: "red" };', "CSS colour name"),
        ('const s = { backgroundColor: "red" };', "JS style colour string"),
        ("const s = { backgroundColor: 'hotpink' };", "JS style colour string"),
        ('<rect style={{ borderTopColor: "teal" }} />', "JS style colour string"),
        ('const s = { color: "var(--brand)" };', "JS style colour string"),
        ('el.style.backgroundColor = "tomato";', "JS style colour string"),
        ("const s = { stroke: `lightblue` };", "JS style colour string"),
        ('<circle fill="hotpink" />', "JS style colour string"),
    ],
)
def test_scan_patterns_catch_off_token_colours(
    snippet: str, kind: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The scan itself is tested: each of these must be reported, so a pattern that stops working fails."""
    d = tmp_path / "frontend/app"
    d.mkdir(parents=True)
    (d / "x.tsx").write_text(snippet)
    monkeypatch.setattr(sys.modules[__name__], "ROOT", tmp_path)
    monkeypatch.setattr(sys.modules[__name__], "SOURCE_DIRS", ["frontend/app"])
    assert kind in {k for _, k, _ in _scan_source()}, f"{snippet!r} was not reported as {kind}"


def test_scan_ignores_tokens_and_plain_text(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    d = tmp_path / "frontend/app"
    d.mkdir(parents=True)
    ok = (
        'const a = "#FFF"; const b = "#2563EB"; href="#main"; '
        'className="text-white bg-card text-ink bg-transparent w-1/2" '
        'const s = { backgroundColor: "var(--color-brand)", fill: "none", '
        'stroke: "currentColor", color: "#2563EB" };'
    )
    (d / "x.tsx").write_text(ok)
    monkeypatch.setattr(sys.modules[__name__], "ROOT", tmp_path)
    monkeypatch.setattr(sys.modules[__name__], "SOURCE_DIRS", ["frontend/app"])
    assert _scan_source() == []


def test_check_contrast_script_passes() -> None:
    assert check_contrast.main() == 0
