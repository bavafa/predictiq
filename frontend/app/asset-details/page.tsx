import { NotBuilt } from "@/components/not-built";
import { ScreenGate } from "@/components/screen-gate";

export default function AssetDetailsPage() {
  return (
    <ScreenGate what="this machine">
      <NotBuilt title="Not built yet — this screen arrives later in the core-screens stage">
        Asset Details will show one machine&rsquo;s sensor history, recent errors and repairs, and what pushed its
        estimate up or down. The replay controls above already work.
      </NotBuilt>
    </ScreenGate>
  );
}
