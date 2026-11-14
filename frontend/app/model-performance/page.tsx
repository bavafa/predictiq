import { NotBuilt } from "@/components/not-built";
import { ScreenGate } from "@/components/screen-gate";

export default function ModelPerformancePage() {
  return (
    <ScreenGate what="the saved evaluation results">
      <NotBuilt title="Not built yet — this screen arrives in the launch stage">
        Model Performance will compare the main model with a simple baseline on held-out data. The replay time is
        shown above for reference only; nothing on this page changes with it.
      </NotBuilt>
    </ScreenGate>
  );
}
