import { validUsername } from "./validation.ts";

export type IdentityMutation = { username: string } | { isAnonymous: boolean };

/** Exactly one field per mutation: changing identity cannot change privacy. */
export function parseIdentityMutation(value: unknown): IdentityMutation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).length !== 1) return null;
  if (typeof body.username === "string") {
    const username = body.username.trim();
    return validUsername(username) ? { username } : null;
  }
  return typeof body.isAnonymous === "boolean" ? { isAnonymous: body.isAnonymous } : null;
}

export const USERNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
export function nextUsernameChangeAt(lastChangedAt: string | null): string | null {
  if (lastChangedAt === null) return null;
  const time = Date.parse(lastChangedAt);
  if (!Number.isFinite(time)) throw new Error("Invalid username change date");
  return new Date(time + USERNAME_COOLDOWN_MS).toISOString();
}
