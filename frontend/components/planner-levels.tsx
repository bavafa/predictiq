"use client";

import { useState } from "react";

import { ComponentPlanner } from "@/components/component-planner";
import { useData } from "@/components/data-provider";
import { PlannerBody } from "@/components/planner-screen";
import { Button } from "@/components/ui/button";

/** The Planner page: the 24-hour machine plan, plus a Parts plan when the deployment has component scores. */
export function PlannerLevels() {
  const { meta, view } = useData();
  if (meta.status !== "ready" || !view) return null;
  if (!meta.meta.component_planner) return <PlannerBody />;
  return <LevelSwitch />;
}

/** Machines (the 24-hour plan) or Parts (the component plan). Each is mounted on first use and then kept, so
 *  switching back does not lose the inputs. */
function LevelSwitch() {
  const [level, setLevel] = useState<"machine" | "parts">("machine");
  const [visited, setVisited] = useState({ machine: true, parts: false });
  const choose = (l: "machine" | "parts") => {
    setLevel(l);
    setVisited((v) => ({ ...v, [l]: true }));
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2" data-testid="level-switch">
        <span id="level-label" className="text-sm font-semibold">
          Plan for
        </span>
        <div role="radiogroup" aria-labelledby="level-label" className="flex gap-2">
          {(
            [
              ["machine", "Machines (next 24 hours)"],
              ["parts", "Parts (7 to 14 days)"],
            ] as const
          ).map(([l, text]) => (
            <Button key={l} role="radio" aria-checked={level === l} variant={level === l ? "primary" : "outline"} data-testid={`level-${l}`} onClick={() => choose(l)}>
              {text}
            </Button>
          ))}
        </div>
      </div>
      <div hidden={level !== "machine"}>{visited.machine && <PlannerBody />}</div>
      <div hidden={level !== "parts"}>{visited.parts && <ComponentPlanner />}</div>
    </div>
  );
}

