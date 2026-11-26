import Link from "next/link";
import { Navbar } from "@/components/play/navbar";
import {
  RANK_DEFINITIONS,
  RANK_POLICY,
  calculateRankPolicyV2,
  competitiveRank,
} from "@/lib/leaderboard/rank-policy";

export default function RatingGuidePage() {
  return (
    <>
      <Navbar />
      <main className="page-shell settings-page" id="main-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">RANKED GUIDE</p>
            <h1>
              How Elo works<span className="title-period">.</span>
            </h1>
          </div>
        </div>
        <p>
          <Link href="/ranked">← Back to Ranked</Link>
        </p>
        <section className="settings-section" style={{ maxWidth: "none" }}>
          <div className="settings-section-heading">
            <h2>Solo rating progression</h2>
            <p>
              Every new player begins at {RANK_POLICY.starting.toLocaleString()} Elo (
              {competitiveRank(RANK_POLICY.starting).label}). Verified Intermediate wins
              increase your rating and losses decrease it. The server records the actual
              change after each completed game. This is a fixed-benchmark solo rating, not
              head-to-head matchmaking Elo.
            </p>
          </div>
          <p>
            Each numbered division spans 100 Elo. Higher ratings award fewer points for a
            victory and deduct more for a defeat. Ratings are bounded between 100 and
            10,000. Omniscient starts at 3,400 Elo and has no divisions.
          </p>
          <h2>Rank thresholds and example rewards</h2>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}
            >
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Entry Elo</th>
                  <th scope="col">Win</th>
                  <th scope="col">Loss</th>
                </tr>
              </thead>
              <tbody>
                {RANK_DEFINITIONS.map((rank) => (
                  <tr key={rank.name} style={{ borderTop: "1px solid #38343b" }}>
                    <th scope="row" style={{ padding: "12px 6px", color: rank.color }}>
                      {rank.name}
                    </th>
                    <td>{rank.min.toLocaleString()}</td>
                    <td>+{calculateRankPolicyV2(rank.min, "won").delta}</td>
                    <td>{calculateRankPolicyV2(rank.min, "lost").delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Examples use the v2 policy at each entry threshold, including the rating
            floor. Actual rewards depend on your rating when the server records the match.
            Rating is separate from account XP.
          </p>
          <h2>Calculation</h2>
          <p>
            Expected score E = 1 / (1 + 10^((1700 − rating) / 1900)). A win adds round(90
            × (1 − E)); a loss subtracts round(45 × E). The result is clamped to the
            allowed rating range.
          </p>
        </section>
      </main>
    </>
  );
}
