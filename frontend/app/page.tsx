import { OverviewScreen } from "@/components/overview-screen";
import { ScreenGate } from "@/components/screen-gate";

export default function OverviewPage() {
  return (
    <ScreenGate what="the plant overview">
      <OverviewScreen />
    </ScreenGate>
  );
}
