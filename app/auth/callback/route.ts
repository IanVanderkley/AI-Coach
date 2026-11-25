import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/sever";
import { callbackPath } from "@/lib/account/validation";
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const fail = () =>
    NextResponse.redirect(new URL("/sign-in?authError=link", url.origin));
  if (!code || url.searchParams.has("error")) return fail();
  try {
    const client = await createClient();
    const flowId = url.searchParams.get("sb_flow_id");
    const { error } = await client.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (error) return fail();
    const response = NextResponse.redirect(
      new URL(callbackPath(url.searchParams.get("kind")), url.origin),
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return fail();
  }
}
