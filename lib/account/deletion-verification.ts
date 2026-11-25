import { createHmac, randomInt, randomUUID } from "node:crypto";

export type DeletionAction =
  | { action: "issue"; password: string; confirmation: "DELETE" }
  | { action: "cancel"; challengeId: string }
  | { action: "delete"; challengeId: string; code: string };

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function parseDeletionAction(value: unknown): DeletionAction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const exact = (...keys: string[]) =>
    Object.keys(body).length === keys.length &&
    keys.every((key) => Object.hasOwn(body, key));
  if (
    body.action === "cancel" &&
    exact("action", "challengeId") &&
    isUuid(body.challengeId)
  ) {
    return { action: "cancel", challengeId: body.challengeId };
  }
  if (
    body.action === "delete" &&
    exact("action", "challengeId", "code") &&
    isUuid(body.challengeId) &&
    typeof body.code === "string" &&
    /^\d{6}$/.test(body.code)
  ) {
    return { action: "delete", challengeId: body.challengeId, code: body.code };
  }
  if (
    body.action === "issue" &&
    exact("action", "password", "confirmation") &&
    typeof body.password === "string" &&
    body.password.length >= 1 &&
    body.password.length <= 1024 &&
    body.confirmation === "DELETE"
  ) {
    return { action: "issue", password: body.password, confirmation: "DELETE" };
  }
  return null;
}

export function newDeletionChallenge() {
  return {
    challengeId: randomUUID(),
    code: String(randomInt(0, 1_000_000)).padStart(6, "0"),
  };
}

export function deletionDigest(
  key: string,
  userId: string,
  sessionId: string,
  email: string,
  challengeId: string,
  code: string,
) {
  if (!/^[a-f0-9]{64}$/i.test(key))
    throw new Error("Deletion verification is not configured.");
  return createHmac("sha256", Buffer.from(key, "hex"))
    .update(
      JSON.stringify([
        "account-deletion-v1",
        userId,
        sessionId,
        email,
        challengeId,
        code,
      ]),
    )
    .digest("hex");
}
