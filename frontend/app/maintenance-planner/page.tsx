import { PlannerScreen } from "@/components/planner-screen";
import { ScreenGate } from "@/components/screen-gate";

export default function MaintenancePlannerPage() {
  return (
    <ScreenGate what="the predicted chances">
      <PlannerScreen />
    </ScreenGate>
  );
}
