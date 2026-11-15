"""Run by test_sizes.py in a separate interpreter: import the Vercel adapter from a copy laid out like the
deployed function (frontend/api/index.py + frontend/_backend/{app,bundle}) and call every data endpoint with
its largest allowed request. Prints one JSON object: endpoint -> {status, bytes, cache}.

Usage: python -I adapter_probe.py <copied frontend folder>"""

import importlib.util
import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

V = "/api/v1"


def main(frontend: Path) -> None:
    spec = importlib.util.spec_from_file_location("adapter_under_test", frontend / "api" / "index.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    client = TestClient(module.app, raise_server_exceptions=False)

    meta = client.get(f"{V}/metadata").json()
    mv, end, start = meta["model_version"], meta["replay_window"]["end"], meta["replay_window"]["start"]
    n = len(meta["machines"])
    out: dict[str, dict[str, object]] = {}

    def call(name: str, url: str) -> None:
        r = client.get(url)
        out[name] = {
            "status": r.status_code,
            "bytes": len(r.content),
            "cache": r.headers.get("cache-control"),
        }

    out["metadata"] = {"status": 200, "bytes": len(client.get(f"{V}/metadata").content), "cache": None}
    call("health", f"{V}/health")
    base = f"mv={mv}&at={end}&cutoff=0"
    call("fleet (100 machines, no filter)", f"{V}/fleet?{base}")
    call("fleet/trend (7d)", f"{V}/fleet/trend?{base}&range=7d")
    # The asset reply is largest where there are most records; take the biggest of all machines.
    biggest = max(
        (client.get(f"{V}/assets/{m}?{base}") for m in range(1, n + 1)), key=lambda r: len(r.content)
    )
    out["assets/{id} (largest of all machines)"] = {
        "status": biggest.status_code,
        "bytes": len(biggest.content),
        "cache": biggest.headers.get("cache-control"),
    }
    call("assets/{id}/telemetry (7d)", f"{V}/assets/1/telemetry?mv={mv}&at={end}&range=7d")
    call("assets/{id}/explanation", f"{V}/assets/1/explanation?mv={mv}&at={end}")
    call("model/metrics", f"{V}/model/metrics?mv={mv}")
    call("model/threshold-analysis", f"{V}/model/threshold-analysis?mv={mv}")
    call("fleet (first hour)", f"{V}/fleet?mv={mv}&at={start}")
    # The largest allowed /plan request: all 100 machines listed, every cost and the slots at their maximum,
    # a per-model cost for all four models, risk reduction at its maximum, and the largest body the service
    # reads. Posted through the adapter like everything else.
    plan_body = {
        "at": end,
        "cutoff_percent": 0,
        "include_below_cutoff": True,
        "failure_cost": 10_000_000,
        "failure_cost_by_model": {
            m: 10_000_000 - i for i, m in enumerate(("model1", "model2", "model3", "model4"))
        },
        "planned_cost": 10_000_000,
        "crew_slots": 100,
        "risk_reduction_percent": 90,
    }
    r = client.post(f"{V}/plan?mv={mv}", json=plan_body)
    out["POST plan (100 machines listed, maximum inputs)"] = {
        "status": r.status_code,
        "bytes": len(r.content),
        "cache": r.headers.get("cache-control"),
        "rows": len(r.json()["rows"]) if r.status_code == 200 else None,
    }
    if meta.get("component_planner") is not None:
        costs = {c: 10_000_000 - i for i, c in enumerate(("comp1", "comp2", "comp3", "comp4"))}
        comp_body = {
            "level": "component",
            "at": end,
            "horizon_days": 14,
            "failure_cost": 10_000_000,
            "failure_cost_by_part": costs,
            "planned_cost": 10_000_000,
            "planned_cost_by_part": costs,
            "crew_slots": 100,
            "risk_reduction_percent": 90,
        }
        r = client.post(f"{V}/plan?mv={mv}", json=comp_body)
        out["POST plan (component level, maximum inputs)"] = {
            "status": r.status_code,
            "bytes": len(r.content),
            "cache": r.headers.get("cache-control"),
            "rows": len(r.json()["rows"]) if r.status_code == 200 else None,
        }
        call("assets/{id}/components", f"{V}/assets/1/components?mv={mv}&at={end}&horizon_days=14")
    print(json.dumps(out))


if __name__ == "__main__":
    main(Path(sys.argv[1]))
