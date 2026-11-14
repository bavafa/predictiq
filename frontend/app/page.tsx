import { NotBuilt } from "@/components/not-built";

export default function FleetOverviewPage() {
  return (
    <NotBuilt title="Not built yet — model results arrive in the data-and-model stage">
      Fleet Overview will rank the sample machines by predicted chance of a failure in the next 24 hours. Nothing is
      scored yet, so no cards, charts or tables are shown.
    </NotBuilt>
  );
}
