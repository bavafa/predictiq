import { HomeScreen } from "@/components/home-screen";
import { ScreenGate } from "@/components/screen-gate";

export default function HomePage() {
  return (
    <ScreenGate what="the plant">
      <HomeScreen />
    </ScreenGate>
  );
}
