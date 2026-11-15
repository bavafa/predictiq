import { PlannerLevels } from "@/components/planner-levels";
import { ScreenGate } from "@/components/screen-gate";

export default function MaintenancePlannerPage() {
  return (
    <ScreenGate what="the predicted chances">
      <PlannerLevels />
    </ScreenGate>
  );
}
