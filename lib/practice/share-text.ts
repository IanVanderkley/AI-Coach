import type { PracticeResultSummary } from "../../components/play/practice-result-dialog";

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function formatPracticeShareText(
  result: Pick<
    PracticeResultSummary,
    "outcome" | "difficulty" | "durationSeconds" | "moveCount" | "flagsOnBoard"
  >,
): string {
  return [
    `AI-Coach Practice ${result.outcome === "win" ? "Win" : "Loss"} · ${result.difficulty}`,
    `${formatTime(result.durationSeconds)} · ${result.moveCount} moves · ${result.flagsOnBoard} flags placed`,
    "Practice game (not a server-verified record).",
  ].join("\n");
}
