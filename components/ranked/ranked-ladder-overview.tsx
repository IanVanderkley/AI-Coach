import { LockKeyhole, ShieldCheck } from "lucide-react";

import { RANKED_LADDERS, RANKED_RP_ENABLED } from "@/lib/ranked/ladders";

/** An honest overview: only the existing Intermediate backend is playable. */
export function RankedLadderOverview() {
  return (
    <section className="ranked-ladders" aria-labelledby="ranked-ladders-title">
      <div className="ranked-ladders-heading">
        <h2 id="ranked-ladders-title">Ranked difficulties</h2>
        <span>Server-controlled results</span>
      </div>
      <div className="ranked-ladder-grid">
        {RANKED_LADDERS.map((ladder) => (
          <div
            className={`ranked-ladder-card${ladder.playable ? " ranked-ladder-available" : ""}`}
            key={ladder.id}
          >
            <div className="ranked-ladder-title">
              <strong>{ladder.label}</strong>
              {ladder.playable ? (
                <span className="ranked-ladder-status">
                  <ShieldCheck size={14} aria-hidden="true" /> Playable
                </span>
              ) : (
                <span className="ranked-ladder-status">
                  <LockKeyhole size={14} aria-hidden="true" /> Planned
                </span>
              )}
            </div>
            <p>
              {ladder.rows} × {ladder.columns} · {ladder.mineCount} mines
            </p>
          </div>
        ))}
      </div>
      <p className="ranked-ladders-note">
        {RANKED_RP_ENABLED
          ? "Competitive RP is enabled."
          : "RP ratings and placement games are not enabled yet. Verified Ranked XP is a separate account reward."}{" "}
        Only Intermediate is playable until the other server-controlled boards are
        implemented.
      </p>
    </section>
  );
}
