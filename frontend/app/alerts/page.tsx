import { AlertsScreen } from "@/components/alerts-screen";
import { ScreenGate } from "@/components/screen-gate";

export default function AlertsPage() {
  return (
    <ScreenGate what="the alerts">
      <AlertsScreen />
    </ScreenGate>
  );
}
