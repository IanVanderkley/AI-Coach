/** Read-only receipt policy. The database, not this module, awards account XP. */
export function isRankedXpReward(outcome: unknown, amount: unknown): boolean {
  return outcome === "won"
    ? amount === 125 || amount === 210 || amount === 350
    : outcome === "lost"
      ? amount === 10 || amount === 17 || amount === 50 || amount === 0
      : false;
}
export type PracticeXpReceipt = {
  difficulty: "Beginner" | "Intermediate" | "Expert";
  outcome: "win" | "loss";
  amount: number;
  reason: "earned" | "participation" | "daily_limit";
};
export function parsePracticeXpReceipt(value: unknown): PracticeXpReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid Practice XP receipt.");
  const r = value as Record<string, unknown>;
  if (
    r.difficulty !== "Beginner" &&
    r.difficulty !== "Intermediate" &&
    r.difficulty !== "Expert"
  )
    throw new Error("Invalid Practice difficulty.");
  if (r.outcome !== "win" && r.outcome !== "loss")
    throw new Error("Invalid Practice outcome.");
  if (r.reason !== "earned" && r.reason !== "participation" && r.reason !== "daily_limit")
    throw new Error("Invalid Practice XP status.");
  const rewards = { Beginner: [25, 5], Intermediate: [50, 10], Expert: [75, 15] };
  const expected =
    r.reason === "earned" ? rewards[r.difficulty][r.outcome === "win" ? 0 : 1] : 0;
  if (r.amount !== expected && !(r.reason === "earned" && r.amount === expected * 2))
    throw new Error("Invalid Practice XP amount.");
  return {
    difficulty: r.difficulty,
    outcome: r.outcome,
    reason: r.reason,
    amount: r.amount as number,
  };
}
