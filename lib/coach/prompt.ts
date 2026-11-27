import { boardShapeOf } from "./board";
import type { CoachPreferences } from "../settings/types";
import type { CoachAnalysis, GameplaySession } from "./types";

// Turns the deterministic analysis into a compact brief for an AI model.
// The model only rewrites this brief in friendlier words — it never decides the
// score, the metrics or which move was the key moment.

export const COACH_SYSTEM_PROMPT = [
  "You are the AI Coach inside a Minesweeper training app.",
  "You receive a factual, already-computed analysis of one game.",
  "Rewrite it as clear, specific coaching for the player.",
  "Rules:",
  "- Stay strictly inside the given facts. Never invent moves, patterns or positions.",
  "- Keep every number exactly as given; do not round or recalculate.",
  "- Be concrete: name the move number and the square when the brief points to one.",
  "- For every improvement, explain WHY the move was wrong, not just what happened.",
  "- Use the supplied clue arithmetic to justify the mistake, and name the safer square when one is given.",
  "- No proven-safe alternative found does not prove an unavoidable guess or equal odds. Never blame unresolved decisions as proven mistakes.",
  "- Sound like a calm human coach, not a robot. No emojis. No markdown.",
  "- Plain English.",
  "Answer with JSON only, using exactly these keys:",
  '{"headline": string, "summary": string, "strengths": string[], "improvements": string[], "nextSteps": string[]}',
  "headline: at most 8 words. summary: at most 2 sentences.",
  "strengths: 2 to 4 items. improvements: 2 to 4 items. nextSteps: 2 to 3 items.",
].join("\n");

const TONE_LINES: Record<CoachPreferences["coachingStyle"], string> = {
  encouraging: "Warm and encouraging; celebrate effort without exaggerating.",
  balanced: "Calm and balanced; honest about mistakes without being harsh.",
  direct: "Direct and concise; skip praise padding and get to the point.",
};

const DETAIL_LINES: Record<CoachPreferences["explanationDetail"], string> = {
  brief:
    "Keep it brief: at most 2 short bullets per section. Each improvement is one sentence.",
  standard:
    "Standard detail: 2 to 4 bullets per section. Each improvement says what went wrong and why it was wrong (one or two sentences).",
  detailed:
    "Detailed: up to 4 bullets per section. Each improvement gives what happened, the clue arithmetic that proved a better move, and the consequence (up to three sentences).",
};

const EXPERIENCE_LINES: Record<CoachPreferences["experienceLevel"], string> = {
  new: "Assume a new player: explain any Minesweeper term the first time you use it.",
  some: "Assume the player knows the basics but not advanced patterns.",
  experienced:
    "Assume an experienced player: use standard terms such as chord and constraint deduction without explanation.",
};

const COMPETITIVE_LINES: Record<CoachPreferences["competitiveness"], string> = {
  relaxed: "Frame progress around learning and enjoyment, not rankings.",
  balanced: "Frame progress around personal improvement and steady habits.",
  competitive:
    "Frame progress around speed and ranking, while still discouraging reckless guesses.",
};

/**
 * The base instructions plus the player's saved Settings preferences. The
 * preference block only shapes wording and emphasis; the factual brief below is
 * still the only source of truth.
 */
export function buildCoachSystemPrompt(preferences?: CoachPreferences): string {
  if (!preferences) return COACH_SYSTEM_PROMPT;
  const goals = [...preferences.selectedGoals, preferences.customGoal.trim()].filter(
    Boolean,
  );
  const lines = [
    COACH_SYSTEM_PROMPT,
    "",
    "PLAYER PREFERENCES (wording only — never change facts, numbers or scores)",
    `- Tone: ${TONE_LINES[preferences.coachingStyle]}`,
    `- Explanation detail: ${DETAIL_LINES[preferences.explanationDetail]}`,
    `- Experience: ${EXPERIENCE_LINES[preferences.experienceLevel]}`,
    `- Competitive framing: ${COMPETITIVE_LINES[preferences.competitiveness]}`,
  ];
  if (goals.length > 0) {
    lines.push(
      `- Learning goals: ${goals.join(", ")}. Emphasise these when the facts support it.`,
    );
  }
  return lines.join("\n");
}

/** The JSON shape we ask every provider to return. */
export type CoachNarrative = {
  headline: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  nextSteps: string[];
};

function bullets(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- (none)";
}

/** Keep one verbose proof from crowding the provider's input budget. */
function shorten(text: string, max = 420): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** The user message: the game facts plus the rule engine's findings. */
export function buildCoachPrompt(
  session: GameplaySession,
  analysis: CoachAnalysis,
): string {
  const shape = boardShapeOf(session);
  const boardLine = shape
    ? `- Board: ${shape.rows} × ${shape.columns} with ${session.mineCount} mines`
    : `- Board: unknown shape with ${session.mineCount} mines`;
  const lines: string[] = [
    "GAME FACTS",
    `- Game: ${session.game ?? "minesweeper"}`,
    `- Difficulty: ${session.difficulty ?? "unknown"}`,
    boardLine,
    `- Outcome: ${session.outcome}`,
    session.durationSeconds !== undefined
      ? `- Duration: ${session.durationSeconds} seconds`
      : "",
    `- Recorded moves: ${session.moves.length}`,
    "- Mine layout available to the analyser: " + (analysis.metrics ? "yes" : "no"),
  ].filter(Boolean);

  if (analysis.metrics) {
    const m = analysis.metrics;
    lines.push(
      "",
      "COMPUTED METRICS",
      `- Certain (logic) reveals: ${m.logicalReveals} of ${m.reveals}`,
      `- Guesses: ${m.guesses} (avoidable: ${m.avoidableGuesses})`,
      `- Flag outcomes: ${m.correctFlags} matched mines, ${m.wrongFlags} did not; these are hindsight counts, not proof of decision quality.`,
      `- Chords used: ${m.chords}`,
      `- Opening click: ${m.openingCell}`,
    );
  }

  lines.push(
    "",
    "RULE ENGINE DRAFT",
    `Headline: ${analysis.headline}`,
    `Summary: ${analysis.summary}`,
    "Strengths:",
    bullets(analysis.strengths),
    "Improvements:",
    bullets(analysis.improvements),
    "Next steps:",
    bullets(analysis.nextSteps),
  );

  if (analysis.keyMoment) {
    lines.push(
      "",
      `KEY MOMENT: move ${analysis.keyMoment.moveNumber} at row ${analysis.keyMoment.row + 1}, column ${analysis.keyMoment.col + 1} — ${analysis.keyMoment.description}`,
    );
    if (analysis.keyMoment.why) {
      lines.push(`WHY: ${analysis.keyMoment.why}`);
    }
  }

  if (analysis.mistakes.length > 0) {
    lines.push("", "MISTAKES TO EXPLAIN (one improvement each, in plain language)");
    for (const mistake of analysis.mistakes.slice(0, 8)) {
      lines.push(
        `- Move ${mistake.moveNumber} at row ${mistake.row + 1}, column ${mistake.col + 1} (${mistake.title})`,
        `  Why: ${shorten(mistake.why)}`,
        `  Better: ${shorten(mistake.fix)}`,
        mistake.betterMove
          ? `  Safe alternative: row ${mistake.betterMove.row + 1}, column ${mistake.betterMove.col + 1}`
          : "  Safe alternative: none was proven",
      );
    }
  }

  lines.push("", "Rewrite the draft above as your JSON answer.");
  return lines.join("\n");
}

/** Pull the JSON object out of a model reply, tolerating code fences or prose. */
export function parseNarrative(text: string): CoachNarrative | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const value = parsed as Record<string, unknown>;
  const strings = (input: unknown): string[] =>
    Array.isArray(input)
      ? input
          .filter(
            (item): item is string => typeof item === "string" && item.trim().length > 0,
          )
          .map((item) => item.trim())
      : [];
  const headline = typeof value.headline === "string" ? value.headline.trim() : "";
  const summary = typeof value.summary === "string" ? value.summary.trim() : "";
  return {
    headline,
    summary,
    strengths: strings(value.strengths),
    improvements: strings(value.improvements),
    nextSteps: strings(value.nextSteps),
  };
}
