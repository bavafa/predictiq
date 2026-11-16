import { JobList } from "@/components/job-list";
import { PlannerLevels } from "@/components/planner-levels";
import { ScreenGate } from "@/components/screen-gate";

export default function MaintenancePlannerPage() {
  return (
    <ScreenGate what="the predicted chances">
      <div className="flex flex-col gap-4">
        <JobList />
        <PlannerLevels />
      </div>
    </ScreenGate>
  );
}
