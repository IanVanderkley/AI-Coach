import Link from "next/link";
import { Navbar } from "@/components/play/navbar";
import { RANK_POLICY_V4, RANK_TIERS_V4 } from "@/lib/leaderboard/rank-policy-v4";
import { rankDefinitionsForPolicy } from "@/lib/leaderboard/rank-display";

export default function RatingGuidePage() {
  const ranks = rankDefinitionsForPolicy(4);
  return (
    <>
      <Navbar />
      <main className="page-shell settings-page" id="main-content">
        <div className="page-heading"><div><p className="eyebrow">RANKED GUIDE</p><h1>How Elo works<span className="title-period">.</span></h1></div></div>
        <p><Link href="/ranked">← Back to Ranked</Link></p>
        <section className="settings-section" style={{ maxWidth: "none" }}>
          <div className="settings-section-heading"><h2>Solo rating progression</h2><p>New players begin at {RANK_POLICY_V4.starting.toLocaleString()} Elo (Gold V). The server awards rating after verified Intermediate matches. Elo is separate from account XP.</p></div>
          <p>Every numbered division advances at 100 points. Copper V includes negative ratings and has no demotion protection. Omniscient starts at 3,300 Elo and has no divisions. Ratings are capped at 10,000 Elo.</p>
          <h2>Rank thresholds and nominal rewards</h2>
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}><thead><tr><th scope="col">Rank</th><th scope="col">Entry Elo</th><th scope="col">Win</th><th scope="col">Loss</th></tr></thead><tbody>
            {ranks.map((rank, index) => <tr key={rank.name} style={{ borderTop: "1px solid #38343b" }}><th scope="row" style={{ padding: "12px 6px", color: rank.color }}>{rank.name}</th><td>{index === 0 ? "Below 500 (including negatives)" : rank.min.toLocaleString()}</td><td>+{RANK_TIERS_V4[index].win}</td><td>−{RANK_TIERS_V4[index].loss}</td></tr>)}
          </tbody></table></div>
          <h2>Demotion protection</h2>
          <p>A loss that would cross a division boundary stops at that division's floor when you start above it. Another loss from the floor demotes you. A win that moves you above a floor restores protection. For example, Gold V at 1,505 loses 5 Elo to reach 1,500, then a further loss deducts 12 Elo to reach Silver I at 1,488.</p>
          <p>Rewards use the rating immediately before settlement. Actual changes can be smaller than the nominal reward due to demotion protection or the rating ceiling. Existing receipts retain their original awards. Final 50/50 compensation is not yet enabled.</p>
        </section>
      </main>
    </>
  );
}
