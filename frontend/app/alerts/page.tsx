import { OverviewScreen } from "@/components/overview-screen";
import { ScreenGate } from "@/components/screen-gate";

// Stage 1 of the v2 redesign adds the route; the cost-ranked Alerts page itself is stage 3. Until then it shows the
// alert cards and the Normal line of the current Home.
export default function AlertsPage() {
  return (
    <ScreenGate what="the alerts">
      <OverviewScreen only="alerts" />
    </ScreenGate>
  );
}
