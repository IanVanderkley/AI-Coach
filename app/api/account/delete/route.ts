import { createClient as createPublicClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/sever";
import { createAdminClient } from "@/lib/supabase/admin";
import { readLimitedCoachJson } from "@/lib/coach/http-security";
const reply = (status: number, error: string) =>
  Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  // Destructive action must be explicitly enabled AFTER disposable staging-account testing.
  if (process.env.ACCOUNT_DELETION_ENABLED !== "true")
    return reply(
      503,
      "Account deletion is not enabled yet. Contact the project administrator.",
    );
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return reply(403, "Invalid request origin.");
  const parsed = await readLimitedCoachJson(request, 2048);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    !("password" in body) ||
    typeof body.password !== "string" ||
    body.password.length < 1 ||
    body.password.length > 1024 ||
    !("confirmation" in body) ||
    body.confirmation !== "DELETE" ||
    Object.keys(body).some((k) => k !== "password" && k !== "confirmation")
  )
    return reply(400, "Enter your current password and DELETE to confirm.");
  try {
    const sessionClient = await createClient();
    const {
      data: { user },
      error: userError,
    } = await sessionClient.auth.getUser();
    if (userError || !user?.email)
      return reply(401, "Sign in again before deleting your account.");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return reply(503, "Account services are unavailable.");
    // Separate stateless client. The password must authenticate the SAME verified user.
    const verifier = createPublicClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await verifier.auth.signInWithPassword({
      email: user.email,
      password: body.password,
    });
    if (error || !data.session || data.user?.id !== user.id)
      return reply(403, "Could not confirm your password. Try again later.");
    const admin = createAdminClient();
    const revoked = await admin.auth.admin.signOut(data.session.access_token, "global");
    if (revoked.error)
      return reply(503, "Could not revoke account sessions. No deletion was attempted.");
    const deletion = await admin.auth.admin.deleteUser(user.id, false);
    if (deletion.error)
      return reply(
        503,
        "Could not delete the account. Sign in again or contact the administrator.",
      );
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return reply(503, "Account services are temporarily unavailable.");
  }
}
