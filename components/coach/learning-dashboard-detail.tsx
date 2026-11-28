import { formatLearningPercent, formatLearningChange, type LearningDashboard } from "@/lib/coach/learning-dashboard";

export function LearningDashboardDetail({ dashboard }: { dashboard: LearningDashboard }) {
  const { learning, trends } = dashboard;
  const { evidence, exclusions } = learning;
  const { comparison, points } = trends;
  const excluded = exclusions.invalid + exclusions.otherVersion + exclusions.conflictingGames;
  const chartPoints = points.map((point, index) => ({
    x: 34 + 530 * index / Math.max(1, points.length - 1),
    accuracy: point.rolling?.accuracy.percent ?? null,
    coverage: point.rolling?.coverage.percent ?? null,
  }));
  const y = (n: number) => 114 - n;
  return (
    <div className="coach-evidence-dashboard">
      <div className="coach-learning-metrics">
        <div>
          <span>Evidence coverage</span>
          <strong>{formatLearningPercent(evidence.decisionCoverage.percent)}</strong>
          {evidence.decisionCoverage.percent !== null && <progress className="coach-learning-metric-bar" aria-label="Evidence coverage" value={evidence.decisionCoverage.percent} max={100} />}
          <small>{evidence.assessed} of {evidence.observed} post-opening actions assessed · {evidence.uncertain} uncertain</small>
        </div>
        <div>
          <span>Average board cleared</span>
          <strong>{formatLearningPercent(learning.averageBoardCleared)}</strong>
          <small>{evidence.games} saved reviews</small>
        </div>
        <div>
          <span>Games with verified mistakes</span>
          <strong>{evidence.gamesWithMistakes.numerator} / {evidence.games}</strong>
          <small>{formatLearningPercent(evidence.gamesWithMistakes.percent)} of reviewed games</small>
        </div>
      </div>
      {excluded > 0 && <p className="verified-note">Some saved reviews could not be compared because of invalid counters, conflicting records or a different analysis version.</p>}
      <details className="coach-learning-disclosure">
        <summary>Progress over time <span>{points.length} reviews</span></summary>
        <div className="coach-learning-detail">
          <p className="verified-note">Five-game rolling accuracy (solid) and evidence coverage (dashed). Missing values are not zero.</p>
          {points.length >= 5 ? (
            <svg className="coach-learning-trend-chart" viewBox="0 0 590 140" role="img" aria-label="Rolling decision accuracy and evidence coverage. Exact values in the table below.">
              {[0, 50, 100].map(n => <g key={n}><line x1="34" x2="564" y1={y(n)} y2={y(n)} stroke="currentColor" opacity="0.18"/><text x="28" y={y(n) + 4} textAnchor="end" fill="currentColor" fontSize="10">{n}%</text></g>)}
              {(["accuracy", "coverage"] as const).map(key => <g key={key} className={`coach-learning-trend-${key}`}>
                {chartPoints.map((point, index) => {
                  const previous = chartPoints[index - 1];
                  const value = point[key];
                  const prior = previous?.[key];
                  return value === null ? null : <g key={index}>
                    {typeof prior === "number" && <line x1={previous.x} y1={y(prior)} x2={point.x} y2={y(value)} stroke="currentColor" strokeWidth="2" strokeDasharray={key === "coverage" ? "5 4" : undefined}/>}
                    <circle cx={point.x} cy={y(value)} r="2.5" fill="currentColor" />
                  </g>;
                })}
              </g>)}
              <text x="34" y="132" fill="currentColor" fontSize="11">Oldest</text><text x="564" y="132" textAnchor="end" fill="currentColor" fontSize="11">Newest</text>
            </svg>
          ) : <p>Save at least five comparable game reviews to see rolling trends.</p>}
          {comparison.comparable && <div className="coach-learning-periods">
            <p>Earlier {comparison.older.games} games: {formatLearningPercent(comparison.older.accuracy.percent)} accuracy · {formatLearningPercent(comparison.older.coverage.percent)} coverage · {comparison.older.assessed} assessed decisions.</p>
            <p>Recent {comparison.recent.games} games: {formatLearningPercent(comparison.recent.accuracy.percent)} accuracy · {formatLearningPercent(comparison.recent.coverage.percent)} coverage · {comparison.recent.assessed} assessed decisions.</p>
            <p>Coverage change: {formatLearningChange(comparison.coverageChange)} · Board cleared change: {formatLearningChange(comparison.boardClearedChange)}{comparison.middleGamesExcluded ? " · Middle review excluded from equal-period comparison." : ""}</p>
          </div>}
          <div className="coach-learning-table-scroll" tabIndex={0} role="region" aria-label="Historical review data">
            <table className="coach-learning-trend-table">
              <caption>Saved games, oldest first</caption>
              <thead><tr><th scope="col">Game</th><th scope="col">Accuracy</th><th scope="col">Coverage</th><th scope="col">Assessed</th><th scope="col">Cleared</th><th scope="col">Rolling accuracy</th><th scope="col">Rolling coverage</th></tr></thead>
              <tbody>{points.map((point, index) => <tr key={point.gameRef}><th scope="row">{index + 1} · {new Date(point.completedAt).toLocaleDateString()}</th><td>{formatLearningPercent(point.game.accuracy.percent)}</td><td>{formatLearningPercent(point.game.coverage.percent)}</td><td>{point.game.assessed}</td><td>{formatLearningPercent(point.game.averageBoardCleared)}</td><td>{formatLearningPercent(point.rolling?.accuracy.percent ?? null)}</td><td>{formatLearningPercent(point.rolling?.coverage.percent ?? null)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="verified-note">{trends.caveat}</p>
        </div>
      </details>
      <details className="coach-learning-disclosure">
        <summary>Individual skill evidence</summary>
        <p className="verified-note">Saved reports do not yet include action-specific evidence. Flagging, revealing, chording and risk-management percentages are not available from these summaries. No rating is inferred from overall accuracy.</p>
      </details>
    </div>
  );
}
