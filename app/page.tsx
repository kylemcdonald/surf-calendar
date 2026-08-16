import type { Metadata } from "next";
import SurfAtlas from "./surf-atlas";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: { absolute: "Swell Season — Global Surf Atlas" },
  description:
    "Explore 50 iconic surf breaks around the world with month-by-month ratings for swell, weather, and surfer level.",
};

export default function Home() {
  return <SurfAtlas />;
}
