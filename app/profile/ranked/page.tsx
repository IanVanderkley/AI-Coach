import type { Metadata } from "next";

import { Navbar } from "@/components/play/navbar";
import { RankedStatsPage } from "@/components/profile/ranked-stats-page";

export const metadata: Metadata = {
  title: "Ranked Statistics | AI-Coach",
  description: "Personal server-verified Intermediate Ranked results and recent matches.",
};

export default function ProfileRankedPage() {
  return (
    <>
      <Navbar />
      <RankedStatsPage />
    </>
  );
}
