import { AssetScreen } from "@/components/asset-screen";
import { ScreenGate } from "@/components/screen-gate";

export default function AssetDetailsPage() {
  return (
    <ScreenGate what="this machine">
      <AssetScreen />
    </ScreenGate>
  );
}
