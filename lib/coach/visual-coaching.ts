import type { EvidenceReport, ReportMoment } from "./evidence-report.ts";
import type { CoachPreferences } from "../settings/types.ts";
import type { ReplayFrame } from "./verified-replay.ts";

const goalCategories: Record<string, readonly string[]> = {
  guessing: ["Unnecessary guess", "Guaranteed-safe reveal"],
  flagging: [
    "Flagged a proven-safe square",
    "Correct logical flag",
    "Opened a proven mine",
  ],
  efficiency: ["Supported chord", "Guaranteed-safe reveal", "Unnecessary guess"],
  patterns: ["Guaranteed-safe reveal", "Supported chord", "Correct logical flag"],
  logic: [
    "Opened a proven mine",
    "Flagged a proven-safe square",
    "Guaranteed-safe reveal",
    "Unnecessary guess",
  ],
};

/** Rank only existing evidence. Mistakes remain ahead of strengths; preferences never change a finding. */
export function prioritizeMoments(
  report: EvidenceReport,
  preferences?: CoachPreferences | null,
): ReportMoment[] {
  const goals = preferences?.selectedGoals ?? [];
  const matches = (moment: ReportMoment) =>
    goals.some(
      (goal) =>
        Object.hasOwn(goalCategories, goal) &&
        goalCategories[goal].includes(moment.category),
    );
  return [...report.moments].sort(
    (a, b) =>
      Number(a.kind !== "mistake") - Number(b.kind !== "mistake") ||
      Number(matches(b)) - Number(matches(a)) ||
      b.occurrences - a.occurrences ||
      a.moveNumber - b.moveNumber,
  );
}

export function coachingLead(
  moment: ReportMoment | undefined,
  preferences?: CoachPreferences | null,
): string {
  if (!moment)
    return "No specific move could be proven good or mistaken in this recording.";
  if (preferences?.coachingStyle === "encouraging") {
    return moment.kind === "mistake"
      ? "One useful improvement to practice next."
      : "Build on this proven strength.";
  }
  if (preferences?.coachingStyle === "direct") {
    return moment.kind === "mistake"
      ? "Prioritize this correction."
      : "Repeat this proven decision.";
  }
  return moment.kind === "mistake" ? "Your next focus" : "A strength to repeat";
}

export function practicePrompt(preferences?: CoachPreferences | null): string {
  if (preferences?.experienceLevel === "new")
    return "Start slowly: identify the visible number supporting your next move before clicking.";
  if (
    preferences?.experienceLevel === "experienced" &&
    preferences.competitiveness === "competitive"
  )
    return "Repeat the lesson on your next board, then work on speed without sacrificing proven-safe decisions.";
  if (preferences?.competitiveness === "relaxed")
    return "Take your time and repeat the lesson without worrying about the clock.";
  return "Try the same deduction on your next Practice board before increasing your speed.";
}

/** A covered, unflagged, proven-safe cell is directly actionable. Never use hidden mines. */
export function recommendedReveal(frame: ReplayFrame): number | null {
  if (!frame.changed || frame.mistakeType !== "unnecessary-guess") return null;
  return (
    frame.deductions.safe.find((proof) => {
      const cell = frame.before[proof.index];
      return cell && !cell.revealed && !cell.flagged;
    })?.index ?? null
  );
}
