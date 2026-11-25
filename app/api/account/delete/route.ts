import { createClient as createPublicClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/sever";
import { createAdminClient } from "@/lib/supabase/admin";
import { readLimitedCoachJson } from "@/lib/coach/http-security";
import {
  deletionDigest,
  isUuid,
  newDeletionChallenge,
  parseDeletionAction,
} from "@/lib/account/deletion-verification";
import { sendDeletionCode } from "@/lib/account/deletion-mail";

const reply = (status: number, error: string) =>
  Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
const success = (data: Record<string, unknown>) =>
  Response.json(data, { headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  if (process.env.ACCOUNT_DELETION_ENABLED !== "true")
    return reply(503, "Account deletion is not enabled yet.");
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return reply(403, "Invalid request origin.");
  const parsed = await readLimitedCoachJson(request, 2048);
  if (!parsed.ok) return parsed.response;
  const body = parseDeletionAction(parsed.value);
  if (!body)
    return reply(400, "Invalid deletion request. Check your confirmation details.");
  try {
    const sessionClient = await createClient();
    const {
      data: { user },
      error: userError,
    } = await sessionClient.auth.getUser();
    if (userError || !user?.email || !user.email_confirmed_at)
      return reply(401, "Sign in with a verified email before deleting your account.");
    const { data: claimsData, error: claimsError } = await sessionClient.auth.getClaims();
    const sessionId = claimsData?.claims.session_id;
    if (claimsError || claimsData?.claims.sub !== user.id || !isUuid(sessionId))
      return reply(401, "Sign in again before deleting your account.");
    const admin = createAdminClient();
    const identity = { p_user_id: user.id, p_session_id: sessionId };
    if (body.action === "cancel") {
      const { error } = await admin.rpc("cancel_account_deletion_challenge", {
        ...identity,
        p_challenge_id: body.challengeId,
      });
      if (error) return reply(503, "Could not cancel the request. Try again.");
      return success({ cancelled: true });
    }
    const key = process.env.ACCOUNT_DELETION_HMAC_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (
      !key ||
      !/^[a-f0-9]{64}$/i.test(key) ||
      !url ||
      !publicKey ||
      !process.env.RESEND_ACCOUNT_DELETION_API_KEY
    )
      return reply(503, "Account deletion verification is unavailable.");
    const params = (challengeId: string, code: string) => ({
      ...identity,
      p_challenge_id: challengeId,
      p_email: user.email!,
      p_code_digest: deletionDigest(
        key,
        user.id,
        sessionId,
        user.email!,
        challengeId,
        code,
      ),
    });
    if (body.action === "issue") {
      const verifier = createPublicClient(url, publicKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
      try {
        const { data, error } = await verifier.auth.signInWithPassword({
          email: user.email,
          password: body.password,
        });
        if (
          error ||
          !data.session ||
          data.user?.id !== user.id ||
          data.user.email !== user.email
        )
          return reply(403, "Could not confirm your password. Try again later.");
        const { challengeId, code } = newDeletionChallenge();
        const { data: issued, error: issueError } = await admin.rpc(
          "issue_account_deletion_challenge",
          params(challengeId, code),
        );
        if (issueError)
          return reply(503, "Could not prepare verification. Try again later.");
        if (issued === "cooldown" || issued === "rate_limited")
          return reply(
            429,
            issued === "cooldown"
              ? "Wait at least 60 seconds before requesting another code."
              : "Too many verification requests. Try again later.",
          );
        if (issued !== "issued") return reply(503, "Could not prepare verification.");
        if (!(await sendDeletionCode(user.email, code))) {
          await admin.rpc("cancel_account_deletion_challenge", {
            ...identity,
            p_challenge_id: challengeId,
          });
          return reply(503, "Could not send the verification email. Try again later.");
        }
        return success({ challengeId });
      } finally {
        await verifier.auth.signOut({ scope: "local" }).catch(() => {});
      }
    }
    // The existing challenge proves password verification at issuance. Before consuming
    // it, obtain the actual access token and verify its identity and session with Auth.
    const { data: sessionData, error: sessionError } =
      await sessionClient.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (sessionError || !accessToken)
      return reply(401, "Sign in again before deleting your account.");
    const { data: finalClaims, error: finalClaimsError } =
      await sessionClient.auth.getClaims(accessToken);
    const { data: finalUser, error: finalUserError } =
      await sessionClient.auth.getUser(accessToken);
    if (
      finalClaimsError ||
      finalUserError ||
      finalClaims?.claims.sub !== user.id ||
      finalClaims.claims.session_id !== sessionId ||
      finalUser.user?.id !== user.id ||
      finalUser.user.email !== user.email ||
      !finalUser.user.email_confirmed_at
    )
      return reply(401, "Sign in again before deleting your account.");
    // No destructive operation is reachable until the bound challenge is consumed.
    const { data: consumed, error: consumeError } = await admin.rpc(
      "consume_account_deletion_challenge",
      params(body.challengeId, body.code),
    );
    if (consumeError) return reply(503, "Could not verify the code. Try again later.");
    if (consumed !== "consumed")
      return reply(
        403,
        consumed === "incorrect"
          ? "Incorrect verification code."
          : "Verification code is invalid, expired or locked. Request a new code.",
      );
    const revoked = await admin.auth.admin.signOut(accessToken, "global");
    if (revoked.error)
      return reply(503, "Could not revoke account sessions. No deletion was attempted.");
    const deletion = await admin.auth.admin.deleteUser(user.id, false);
    if (deletion.error)
      return reply(
        503,
        "Could not delete the account. Sign in again or contact the administrator.",
      );
    return success({ deleted: true });
  } catch {
    return reply(503, "Account services are temporarily unavailable.");
  }
}
