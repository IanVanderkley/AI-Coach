import { showRecentCount, showRecentWinRate } from "@/lib/profile/player-dashboard";
import type { PracticeDifficultySummary } from "@/lib/profile/practice-difficulty";

const BOARD_LABELS = {
  Beginner: "9 × 9 · 10 mines",
  Intermediate: "16 × 16 · 40 mines",
  Expert: "16 × 30 · 99 mines",
};

function formatSeconds(seconds: number | null): string {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

/** Uses only the Practice history already loaded for the current browser/account. */
export function PracticeDifficultyStats({
  breakdown,
  scope = "recent",
}: {
  breakdown: PracticeDifficultySummary[] | null;
  scope?: "recent" | "tracked";
}) {
  return (
    <section
      className="practice-difficulty-panel"
      aria-labelledby="practice-difficulty-title"
    >
      <div className="practice-difficulty-header">
        <div>
          <span className="player-dashboard-eyebrow">PRACTICE PERFORMANCE</span>
          <h2 id="practice-difficulty-title">By difficulty</h2>
        </div>
        <span className="practice-difficulty-scope">
          {scope === "tracked" ? "Tracked account games" : "Recent saved games"}
        </span>
      </div>
      <div className="practice-difficulty-grid">
        {(["Beginner", "Intermediate", "Expert"] as const).map((difficulty) => {
          const summary = breakdown?.find((item) => item.difficulty === difficulty);
          return (
            <div className="practice-difficulty-card" key={difficulty}>
              <strong className="practice-difficulty-name">{difficulty}</strong>
              <span className="practice-difficulty-board">
                {BOARD_LABELS[difficulty]}
              </span>
              <div className="practice-difficulty-rate">
                <strong>{showRecentWinRate(summary?.stats.winRate)}</strong>
                <span>Win rate</span>
              </div>
              <div className="practice-difficulty-details">
                <span>
                  Games <strong>{showRecentCount(summary?.stats.games ?? null)}</strong>
                </span>
                <span>
                  Wins <strong>{showRecentCount(summary?.stats.wins ?? null)}</strong>
                </span>
                <span>
                  Best win{" "}
                  <strong>{formatSeconds(summary?.fastestWinSeconds ?? null)}</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="player-dashboard-honesty">
        {scope === "tracked"
          ? "Account-recorded Practice results include retained history at tracking activation and future uploads. Older games may have been trimmed before tracking; results are not server-verified."
          : "These are self-recorded Practice games currently saved to this account or browser, not verified lifetime results. Older games may have been trimmed."}
      </p>
    </section>
  );
}
