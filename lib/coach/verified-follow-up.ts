import type { EvidenceReport, ReportMoment } from "./evidence-report.ts";

// Phase 4: one evidence-grounded question about ONE reported move.
// These responses are assembled from verified findings; no AI key is needed.
// Open-ended interpretations and hypothetical counterfactuals are intentionally
// not answered because the replay does not verify them.

export type QuestionIntent = "why" | "evidence" | "next";
export type FollowUpAnswer = {
  momentId: string;
  scope?: "game";
  moveNumber: number;
  intent: QuestionIntent;
  question: string;
  title: string;
  paragraphs: string[];
};
export type FollowUpResult =
  | { supported: true; answer: FollowUpAnswer }
  | { supported: false; message: string };

export const SUGGESTED_QUESTIONS = [
  "Why was this decision classified this way?",
  "What did the visible board prove?",
  "What should I try next time?",
] as const;

const SIMPLE_QUESTION = "Explain this move in simple terms.";

export const GAME_FOLLOW_UP_ID = "whole-game";
export const GAME_FOLLOW_UP_QUESTIONS = [
  "How did I do in this game?",
  "What was my biggest area to improve?",
  "What did I do well?",
  "What should I practice next?",
] as const;

/** Context is explicit: a suggestion belongs to the answer it follows. */
export function contextualFollowUpQuestions(answer: FollowUpAnswer): readonly string[] {
  const choices = answer.scope === "game" ? GAME_FOLLOW_UP_QUESTIONS : [
    "What did the visible board prove?",
    "What should I try next time?",
    SIMPLE_QUESTION,
  ];
  return choices.filter(q => q.toLowerCase() !== answer.question.trim().toLowerCase());
}

/** Whole-game answers are limited to the post-opening report, including ungraded actions. */
export function answerGameFollowUp(report: EvidenceReport, question: string): FollowUpResult {
  const text = question.trim();
  if (text.length < 5 || text.length > 240) return { supported: false, message: "Enter a question between 5 and 240 characters." };
  const normalized = text.toLowerCase().replace(/[?.!]+$/, "").trim();
  const is = (...phrases: string[]) => phrases.some(phrase => normalized === phrase.toLowerCase().replace(/[?.!]+$/, ""));
  const mistakes = report.moments.filter(m => m.kind === "mistake").sort((a,b) => b.occurrences - a.occurrences || a.moveNumber - b.moveNumber);
  const good = report.moments.filter(m => m.kind === "good").sort((a,b) => b.occurrences - a.occurrences || a.moveNumber - b.moveNumber);
  const summary = `After the opening, ${report.provenGood} actions were proven good, ${report.verifiedMistakes} were verified mistakes, and ${report.uncertainActions} had insufficient evidence for a definite judgment.`;
  const limit = "These findings cover this completed game under the review's rules. An uncertain action is not automatically a mistake or an unavoidable guess.";
  let title: string, paragraphs: string[], focus: ReportMoment | undefined, intent: QuestionIntent = "why";
  if (is(GAME_FOLLOW_UP_QUESTIONS[0], "summarize my game", "how did i play", "give me a game summary")) {
    title = "Your game in review";
    paragraphs = [summary, limit];
    focus = mistakes[0] ?? good[0];
    if (focus) paragraphs.push(`One useful example is move ${focus.moveNumber}: ${focus.category.toLowerCase()}.`);
  } else if (is(GAME_FOLLOW_UP_QUESTIONS[1], GAME_FOLLOW_UP_QUESTIONS[3], "what should i improve", "what should i practice")) {
    title = "Your next practice focus";
    intent = "next";
    focus = mistakes[0];
    paragraphs = [summary];
    if (focus) paragraphs.push(`Among the reported mistake categories, ${focus.category.toLowerCase()} occurred ${focus.occurrences} time${focus.occurrences === 1 ? "" : "s"}. Review move ${focus.moveNumber} for an example.`, focus.nextTime);
    else paragraphs.push("There is no reported verified mistake to prioritize. Review the available clues and practice finding proven-safe squares before guessing.");
    paragraphs.push(limit);
  } else if (is(GAME_FOLLOW_UP_QUESTIONS[2], "what were my strengths", "what did i get right")) {
    title = "What you did well";
    focus = good[0];
    paragraphs = [summary];
    if (focus) paragraphs.push(`A verified example is move ${focus.moveNumber}: ${focus.finding}`, focus.evidence);
    else paragraphs.push("There is no representative proven-good moment in this report. That does not establish poor overall skill.");
    paragraphs.push(limit);
  } else {
    return { supported: false, message: "Choose a whole-game question about the summary, strengths or practice focus. To ask about a specific move, select it first. For square analysis, open the replay." };
  }
  return { supported: true, answer: { scope: "game", momentId: GAME_FOLLOW_UP_ID, moveNumber: focus?.moveNumber ?? -1, intent, question: text, title, paragraphs: paragraphs.map(plainFollowUpCoordinates) } };
}


/** Suggestions describe the selected reported move, never an unseen board. */
export function guidedFollowUpQuestions(moment?: ReportMoment): readonly string[] {
  if (!moment) return SUGGESTED_QUESTIONS;
  const why = moment.kind === "mistake" ? "Why was this a mistake?" : "Why was this a good move?";
  const evidence = moment.action === "flag" ? "What did the visible clues prove about this flag?" : "What did the visible clues prove about this move?";
  return [why, evidence, SUGGESTED_QUESTIONS[2], SIMPLE_QUESTION];
}

/** Translate solver coordinates in responses without altering evidence IDs. */
export function plainFollowUpCoordinates(text: string): string {
  return text.replace(/\bR(\d+)C(\d+)\b/gi, (_match, row: string, column: string) => `row ${row}, column ${column}`);
}

/** The text is only used to recognize one of three safe, rule-backed intents. */
export function classifyVerifiedQuestion(question: string): QuestionIntent | null {
  const text = question.trim().toLowerCase();
  if (text.length < 5 || text.length > 240) return null;

  // We cannot establish counterfactual timelines from a single verified move.
  if (
    /\b(what if|would (i|it|the|this)|if i (had|did)|hypothetical|predict\w*|chance\w*|probabilit\w*|odds|could i have won)\b/i.test(
      text,
    )
  ) {
    return null;
  }

  if (
    /\b(what (should|could) i (do|try)|next time|improv\w*|practic\w*|instead|avoid|do better|recommend\w*|tip\b|advice|strategy)\b/i.test(
      text,
    )
  ) {
    return "next";
  }
  if (
    /\b(prov\w*|proof|evidence|certain|guaranteed|visible|numbers?|deduc\w*|how (did|do|can) (you|we|the board) know|how (was|is) (this|it) (known|proven))\b/i.test(
      text,
    )
  ) {
    return "evidence";
  }
  if (
    /\b(why|explain|mistake|wrong|good|strong|decision|classif\w*|mean|happen\w*)\b/i.test(
      text,
    )
  ) {
    return "why";
  }
  return null;
}

function answerForMoment(
  moment: ReportMoment,
  intent: QuestionIntent,
  question: string,
): FollowUpAnswer {
  const reference = `Move ${moment.moveNumber} at ${moment.location}`;
  if (intent === "evidence") {
    return {
      momentId: moment.id,
      moveNumber: moment.moveNumber,
      intent,
      question,
      title: "What the board proved",
      paragraphs: [
        `${reference}: ${moment.finding}`,
        `The verified deduction was: ${moment.evidence}`,
        "This proof uses only the squares and numbers visible before that move. It does not rely on the hidden mine positions to judge the decision.",
      ],
    };
  }
  if (intent === "next") {
    return {
      momentId: moment.id,
      moveNumber: moment.moveNumber,
      intent,
      question,
      title: "What to try next time",
      paragraphs: [
        `${reference} is an example of ${moment.category.toLowerCase()}.`,
        moment.nextTime,
        "Look for a similar visible-board situation in your next game. This recommendation is based on this recorded decision, not a claim about your overall skill.",
      ],
    };
  }
  return {
    momentId: moment.id,
    moveNumber: moment.moveNumber,
    intent,
    question,
    title:
      moment.kind === "mistake"
        ? "Why this was a verified mistake"
        : "Why this was a proven good move",
    paragraphs: [
      `${reference}: ${moment.finding}`,
      `The evidence available at the time was: ${moment.evidence}`,
      `A useful next step: ${moment.nextTime}`,
    ],
  };
}

export function answerVerifiedFollowUp(
  report: EvidenceReport,
  momentId: string,
  question: string,
): FollowUpResult {
  const moment = report.moments.find((item) => item.id === momentId);
  if (!moment) {
    return {
      supported: false,
      message: "That move isn't one of the verified coaching moments in this report.",
    };
  }
  if (question.trim().length < 5 || question.trim().length > 240) return { supported: false, message: "Enter a question between 5 and 240 characters about this move." };
  // The report contains one teaching moment, not a general square-inspection
  // context. Do not answer a coordinate question with an unrelated proof.
  if (/\b(?:r\s*\d+\s*c\s*\d+|row\s*#?\s*\d+|col(?:umn)?\s*#?\s*\d+)\b/i.test(question)) {
    return { supported: false, message: "To ask about a particular square, open this move in replay and select the square on the board. Here you can ask about the selected teaching moment." };
  }
  if ([...question.matchAll(/\bmove\s*#?\s*(\d+)\b/gi)].some(match => Number(match[1]) !== moment.moveNumber)) {
    return { supported: false, message: "Select the move you want to ask about. Questions comparing multiple moves are not supported yet." };
  }
  const intent = classifyVerifiedQuestion(question);
  if (!intent) {
    return {
      supported: false,
      message:
        "I can't verify an answer to that question from the recorded move. Try asking why the move was classified this way, what the visible board proved, or what to try next time. Unsupported questions do not use your one follow-up.",
    };
  }
  const answer = answerForMoment(moment, intent, question.trim());
  if (question.trim().toLowerCase() === SIMPLE_QUESTION.toLowerCase()) {
    answer.title = "The short explanation";
    answer.paragraphs = [moment.finding, `Next time: ${moment.nextTime}`];
  }
  return { supported: true, answer: { ...answer, paragraphs: answer.paragraphs.map(plainFollowUpCoordinates) } };
}
