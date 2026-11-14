import { NotBuilt } from "@/components/not-built";

export default function MaintenancePlannerPage() {
  return (
    <NotBuilt title="Not built yet — model results arrive in the data-and-model stage">
      Maintenance Planner will turn predicted risk into a short repair list using cost assumptions you can change. It
      needs model scores first, so there are no assumptions or lists here yet.
    </NotBuilt>
  );
}
