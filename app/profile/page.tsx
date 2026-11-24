import type { Metadata } from "next";

import { Navbar } from "@/components/play/navbar";
import { PracticeProfile } from "@/components/profile/practice-profile";
import "@/styles/practice-profile.css";
import "@/styles/profile-levels.css";
import "@/styles/profile-history-controls.css";

export const metadata: Metadata = {
  title: "Player Dashboard | AI-Coach",
  description: "Review recent Ranked and Practice results and your player progression.",
};

export default function ProfilePage() {
  return (
    <>
      <Navbar />
      <PracticeProfile />
    </>
  );
}
