import { guardPublicCoachPost } from "@/lib/coach/public-rate-guard";
import { checkPublicCoachRateLimit } from "@/lib/coach/public-rate-limit";
import { prepareVerifiedAnalysis } from "@/lib/coach/verified-analysis";
import { readLimitedCoachJson, VERIFIED_MAX_BODY_BYTES } from "@/lib/coach/http-security";
import { makeVerifiedBrief } from "@/lib/coach/verified-brief";

// Read-only deterministic analysis; does not call an AI provider.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  return guardPublicCoachPost(request, checkPublicCoachRateLimit, () =>
    handleVerifiedBriefPost(request),
  );
}

async function handleVerifiedBriefPost(request: Request): Promise<Response> {
  const parsed = await readLimitedCoachJson(request, VERIFIED_MAX_BODY_BYTES);
  if (!parsed.ok) return parsed.response;

  const prepared = prepareVerifiedAnalysis(parsed.value);
  if (!prepared.ok) {
    return Response.json({ error: prepared.error }, { status: prepared.status, headers });
  }

  try {
    const brief = makeVerifiedBrief(prepared.game, prepared.report);
    return Response.json(brief, { headers });
  } catch {
    return Response.json(
      { error: "Replay did not match the recording. No AI brief was produced." },
      { status: 422, headers },
    );
  }
}
