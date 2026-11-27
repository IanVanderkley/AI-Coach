import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
            <h1>
              Intermediate Ranked Leaderboard<span className="title-period">.</span>
            </h1>
          </div>
        </div>
        <VerifiedLeaderboard />
        <p className="leaderboard-bottom-link">
          <strong>Leaderboard visibility.</strong>{" "}
          Ranked players appear publicly by default. Anonymous mode hides your name and results.{" "}
          <Link href="/settings">Manage visibility</Link>
        </p>
      </main>
    </>
  );
}
