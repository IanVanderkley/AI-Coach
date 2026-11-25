import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/sever";
import { PUBLIC_USERNAME_PATTERN } from "@/lib/leaderboard/public-standings";
import { readBoundedJson } from "@/lib/http/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

/** Account owner only. Never fall back to a user's e-mail as a public name. */
export async function GET() {
  try {
    const auth = await createClient();
    const {
      data: { user },
      error,
    } = await auth.auth.getUser();
    if (error || !user)
      return Response.json({ error: "Sign in first." }, { status: 401, headers });
    const admin = createAdminClient();
    const { data, error: readError } = await admin
      .from("ranked_leaderboard_profiles")
      .select("username,is_anonymous,rating,games,wins,losses")
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) throw readError;
    const preferred = user.user_metadata?.username;
    return Response.json(
      {
        username:
          data?.username ??
          (typeof preferred === "string" && PUBLIC_USERNAME_PATTERN.test(preferred)
            ? preferred
            : ""),
        isAnonymous: data?.is_anonymous ?? false,
        rating: data?.rating ?? 1000,
        games: data?.games ?? 0,
        wins: data?.wins ?? 0,
        losses: data?.losses ?? 0,
      },
      { status: 200, headers },
    );
  } catch {
    return Response.json(
      { error: "Could not load leaderboard settings." },
      { status: 503, headers },
    );
  }
}

/** Save only owner-controlled display name and privacy choice. Not Elo or XP. */
export async function PUT(request: Request) {
  try {
    const parsed = await readBoundedJson(request, 2048, true);
    if (!parsed.ok) return parsed.response;
    const auth = await createClient();
    const {
      data: { user },
      error,
    } = await auth.auth.getUser();
    if (error || !user)
      return Response.json({ error: "Sign in first." }, { status: 401, headers });
    const value = parsed.value;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return Response.json({ error: "Invalid settings." }, { status: 400, headers });
    }
    const payload = value as Record<string, unknown>;
    if (
      typeof payload.isAnonymous !== "boolean" ||
      typeof payload.username !== "string" ||
      Object.keys(payload).some((key) => key !== "isAnonymous" && key !== "username")
    ) {
      return Response.json({ error: "Invalid settings." }, { status: 400, headers });
    }
    const username = payload.username.trim();
    if (username !== "" && !PUBLIC_USERNAME_PATTERN.test(username)) {
      return Response.json(
        { error: "Use 3–20 letters, digits, or underscores for your username." },
        { status: 400, headers },
      );
    }
    if (!payload.isAnonymous && username.length === 0) {
      return Response.json(
        { error: "Choose a username before joining the leaderboard." },
        { status: 400, headers },
      );
    }
    const admin = createAdminClient();
    const { error: writeError } = await admin.from("ranked_leaderboard_profiles").upsert(
      {
        user_id: user.id,
        username: username || null,
        is_anonymous: payload.isAnonymous,
      },
      { onConflict: "user_id" },
    );
    if (writeError?.code === "23505") {
      return Response.json(
        { error: "That public username is already taken." },
        { status: 409, headers },
      );
    }
    if (writeError) throw writeError;
    return Response.json(
      { username, isAnonymous: payload.isAnonymous },
      { status: 200, headers },
    );
  } catch {
    return Response.json(
      { error: "Could not save leaderboard settings." },
      { status: 503, headers },
    );
  }
}
