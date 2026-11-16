import { ScreenGate } from "@/components/screen-gate";
import { WorkPlan } from "@/components/work-plan";

export default function WorkPlanPage() {
  return (
    <ScreenGate what="the work plan">
      <WorkPlan />
    </ScreenGate>
  );
}
