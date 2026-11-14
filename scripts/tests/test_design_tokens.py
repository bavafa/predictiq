"""The design tokens are what ships.

docs/design/tokens.json is the source of truth. This test checks:
1. every contrast pair in tokens.json (4.5:1 for text, 3:1 for ui; "forbidden" pairs must really fail),
   using the same formula as docs/design/check-contrast.py (it is loaded, not copied);
2. every colour variable in frontend/app/globals.css equals the token it is named for;
3. the chart colour constants in the chart components equal their tokens;
4. no hex colour appears anywhere in the app source that is not a tokens.json value.
"""

from __future__ import annotations

import importlib.util
import json
import re
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
HEX = re.compile(r"#[0-9a-fA-F]{6}\b")


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


def test_no_off_token_hex_in_app_source() -> None:
    allowed = all_token_values()
    stray: list[str] = []
    for d in SOURCE_DIRS:
        for f in sorted((ROOT / d).rglob("*")):
            if f.suffix not in {".ts", ".tsx", ".css"}:
                continue
            for hit in HEX.findall(f.read_text()):
                if hit.lower() not in allowed:
                    stray.append(f"{f.relative_to(ROOT)}: {hit}")
    assert stray == [], "colours in app source that are not in tokens.json:\n" + "\n".join(stray)


def test_check_contrast_script_passes() -> None:
    assert check_contrast.main() == 0
