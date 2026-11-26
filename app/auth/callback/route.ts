import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/sever";
import { callbackPath } from "@/lib/account/validation";
import { isFirstEmailConfirmation } from "@/lib/account/email-confirmation";
import { authLinkFailurePath } from "@/lib/account/auth-link-feedback";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const params = url.searchParams;
  const code = params.get("code");
  const kind = params.get("kind");
  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, url.origin));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  const emailStatus = (status: "pending" | "complete" | "error") =>
    redirect(`/auth/email-change?status=${status}#email-change`);
  const fail = () => redirect(authLinkFailurePath(kind));

  if (isFirstEmailConfirmation(params)) return emailStatus("pending");
  if (
    !code ||
    params.has("error") ||
    params.has("error_code") ||
    params.has("error_description")
  )
    return fail();
  try {
    const client = await createClient();
    const flowId = params.get("sb_flow_id");
    const { error } = await client.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (error) return fail();
    if (kind === "email") return emailStatus("complete");
    return redirect(callbackPath(kind));
  } catch {
    return fail();
  }
}
