import { Bomb, Flag, Timer } from "lucide-react";

type GameStatsProps = {
  minesRemaining: number;
  totalMines: number;
  flaggedCount: number;
  elapsedTime: string;
  difficulty: string;
  status: "loading" | "saved" | "ready" | "playing" | "paused" | "won" | "lost";
};

const labels: Record<GameStatsProps["status"], string> = {
  loading: "Checking saved game…",
  saved: "Saved game available",
  ready: "Ready to play",
  playing: "Game in progress",
  paused: "Game paused",
  won: "Victory",
  lost: "Game completed",
};

export function GameStats({
  minesRemaining,
  totalMines,
  flaggedCount,
  elapsedTime,
  difficulty,
  status,
}: GameStatsProps) {
  return (
    <div className="practice-dashboard">
      <div className="practice-status-row">
        <span className="practice-match-status" data-status={status} role="status">
          <span aria-hidden="true" /> {labels[status]}
        </span>
        <span>Practice · {difficulty}</span>
      </div>
      <dl className="game-stats practice-metrics">
        <div className="stat">
          <Timer size={17} aria-hidden="true" />
          <dt className="stat-label">Time elapsed</dt>
          <dd className="stat-value">{elapsedTime}</dd>
        </div>
        <div className="stat">
          <Flag size={17} aria-hidden="true" />
          <dt className="stat-label">Flags placed</dt>
          <dd className="stat-value">
            {flaggedCount} <small className="stat-total">/ {totalMines}</small>
          </dd>
        </div>
        <div className="stat">
          <Bomb size={17} aria-hidden="true" />
          <dt className="stat-label">Mines left</dt>
          <dd className="stat-value">{minesRemaining}</dd>
        </div>
      </dl>
    </div>
  );
}
