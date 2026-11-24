import type { Metadata } from "next";

import { Navbar } from "@/components/play/navbar";
import { PracticeStatsPage } from "@/components/profile/practice-stats-page";

export const metadata: Metadata = {
  title: "Practice Statistics | AI-Coach",
  description: "Saved Practice statistics by difficulty and recent match recordings.",
};

export default function ProfilePracticePage() {
  return (
    <>
      <Navbar />
      <PracticeStatsPage />
    </>
  );
}
