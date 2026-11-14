import { ModelPerformanceScreen } from "@/components/model-performance-screen";
import { ScreenGate } from "@/components/screen-gate";

export default function ModelPerformancePage() {
  return (
    <ScreenGate what="the saved evaluation results">
      <ModelPerformanceScreen />
    </ScreenGate>
  );
}
