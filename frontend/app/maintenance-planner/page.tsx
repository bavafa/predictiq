import { NotBuilt } from "@/components/not-built";
import { ScreenGate } from "@/components/screen-gate";

export default function MaintenancePlannerPage() {
  return (
    <ScreenGate what="the predicted chances">
      <NotBuilt title="Not built yet — this screen arrives in the planning stage">
        Maintenance Planner will turn predicted risk into a short repair list using cost assumptions you can change.
        The replay controls above already work.
      </NotBuilt>
    </ScreenGate>
  );
}
