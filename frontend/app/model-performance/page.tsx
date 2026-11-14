import { NotBuilt } from "@/components/not-built";

export default function ModelPerformancePage() {
  return (
    <NotBuilt title="Not built yet — model results arrive in the data-and-model stage">
      Model Performance will compare the main model with a simple baseline on held-out data. No model has been trained
      or evaluated, so there are no results to show.
    </NotBuilt>
  );
}
