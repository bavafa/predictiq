import { NotBuilt } from "@/components/not-built";
import { ScreenGate } from "@/components/screen-gate";

export default function FleetOverviewPage() {
  return (
    <ScreenGate what="the fleet">
      <NotBuilt title="Not built yet — this screen arrives later in the core-screens stage">
        Fleet Overview will rank the sample machines by predicted chance of a failure in the next 24 hours at the
        replay time. The replay controls above already work and are kept in the web address.
      </NotBuilt>
    </ScreenGate>
  );
}
