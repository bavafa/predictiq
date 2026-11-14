import { FleetScreen } from "@/components/fleet-screen";
import { ScreenGate } from "@/components/screen-gate";

export default function FleetOverviewPage() {
  return (
    <ScreenGate what="the fleet">
      <FleetScreen />
    </ScreenGate>
  );
}
