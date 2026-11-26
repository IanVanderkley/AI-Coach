// Display-only clock. Verified finish times always come from the Ranked server.
export type RankedClockAnchor = { elapsedMs: number; observedAtMs: number };

export function recoveredRankedClock(
  startedAt: unknown,
  serverDate: string | null,
  observedAtMs: number,
): RankedClockAnchor | null {
  if (typeof startedAt !== "string" || !serverDate || !Number.isFinite(observedAtMs)) {
    return null;
  }
  const started = Date.parse(startedAt);
  const server = Date.parse(serverDate);
  if (!Number.isFinite(started) || !Number.isFinite(server)) return null;
  return { elapsedMs: Math.max(0, server - started), observedAtMs };
}

// The first reveal response does not contain a server start timestamp. Use a
// midpoint estimate until the next ordinary recovery; never send it to the API.
export function firstRevealClock(
  requestStartedAtMs: number,
  observedAtMs: number,
): RankedClockAnchor {
  return {
    elapsedMs: Math.max(0, observedAtMs - requestStartedAtMs) / 2,
    observedAtMs,
  };
}

export function rankedDisplaySeconds(anchor: RankedClockAnchor, nowMs: number): number {
  return Math.floor((anchor.elapsedMs + Math.max(0, nowMs - anchor.observedAtMs)) / 1000);
}

export function formatDisplaySeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const clock = `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${clock}` : clock;
}
