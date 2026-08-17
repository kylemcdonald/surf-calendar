import type { Metadata } from "next";
import SurfAtlas from "./surf-atlas";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: { absolute: "Swell Season — Global Surf Atlas" },
  description:
    "Compare 50 iconic surf breaks with explainable month-by-month scores that recompute for a shortboard or longboard.",
};

export default function Home() {
  return <SurfAtlas />;
}
