import type { EvidenceReport } from "./evidence-report.ts";
import { prepareVerifiedAnalysis } from "./verified-analysis.ts";

/**
 * The AI-focus endpoint must validate the same checkpoint-stamped recording
 * as the provider-neutral verified-brief endpoint.
 *
 * A 400 is a malformed recording; a 422 is a well-shaped recording whose
 * board replay, checkpoints, or declared outcome do not agree.
 *
 * This checks replay consistency, NOT authenticity of a client-recorded game.
 */
export type VerifiedFocusInput =
  | { ok: true; report: EvidenceReport }
  | { ok: false; status: 400 | 422; error: string };

export function prepareVerifiedFocusInput(raw: unknown): VerifiedFocusInput {
  const prepared = prepareVerifiedAnalysis(raw);
  return prepared.ok ? { ok: true, report: prepared.analysis.report } : prepared;
}
