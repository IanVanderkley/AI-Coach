import { isAllowedRequestOrigin, readBoundedJson } from "../http/request-security.ts";

// Coaching uses the shared, bounded HTTP request boundary.
export const COACH_MAX_BODY_BYTES = 100_000;
export const VERIFIED_MAX_BODY_BYTES = 200_000;

export function isAllowedCoachOrigin(request: Request): boolean {
  return isAllowedRequestOrigin(request);
}

export async function readLimitedCoachJson(request: Request, maxBytes: number) {
  return readBoundedJson(request, maxBytes);
}
