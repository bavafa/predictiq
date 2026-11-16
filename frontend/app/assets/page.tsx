import { FleetScreen } from "@/components/fleet-screen";
import { ScreenGate } from "@/components/screen-gate";

export default function AssetsPage() {
  return (
    <ScreenGate what="the assets">
      <FleetScreen />
    </ScreenGate>
  );
}
