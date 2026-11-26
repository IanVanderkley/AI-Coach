import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Trophy } from "lucide-react";

import { VerifiedLeaderboard } from "@/components/leaderboard/verified-leaderboard";
import { Navbar } from "@/components/play/navbar";

export const metadata: Metadata = {
  title: "Ranked Leaderboard | AI-Coach",
  description:
    "Public solo rating standings and server-verified Intermediate Ranked victories.",
};

export default function LeaderboardPage() {
  return (
    <>
      <a className="skip-link" href="#leaderboard-content">
        Skip to leaderboard
      </a>
      <Navbar />
      <main className="page-shell leaderboard-page" id="leaderboard-content">
        <Link href="/ranked" className="leaderboard-back-link">
          <ArrowLeft size={16} aria-hidden="true" /> Back to Ranked
        </Link>
        <div className="leaderboard-hero">
          <div>
            <p className="eyebrow">COMPETE. VERIFY. IMPROVE.</p>
            <h1>
              Leaderboard<span className="title-period">.</span>
            </h1>
            <p className="leaderboard-subtitle">
              Competitive Elo standings and fastest verified victories. Ranked players
              appear publicly by default and can choose Anonymous mode in Settings.
            </p>
            <span className="leaderboard-verification">
              <ShieldCheck size={15} aria-hidden="true" /> Server-verified results
            </span>
          </div>
          <Trophy className="leaderboard-hero-icon" size={54} aria-hidden="true" />
        </div>
        <VerifiedLeaderboard />
        <p className="leaderboard-bottom-link">
          New Ranked players appear by default. You can hide your results at any time in{" "}
          <Link href="/settings">Settings</Link>.
        </p>
      </main>
    </>
  );
}
