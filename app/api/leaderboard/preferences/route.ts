import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/sever";
import { readBoundedJson } from "@/lib/http/request-security";
import {
  usernameContentProblem,
  USERNAME_CONTENT_ERROR,
} from "@/lib/account/username-moderation";
import { nextUsernameChangeAt, parseIdentityMutation } from "@/lib/account/username";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const columns = "username,is_anonymous,rating,games,wins,losses,username_changed_at";

type Profile = {
  username: string;
  is_anonymous: boolean;
  rating: number;
  games: number;
  wins: number;
  losses: number;
  username_changed_at: string | null;
};
function response(data: Profile) {
  return Response.json(
    {
      username: data.username,
      isAnonymous: data.is_anonymous,
      rating: data.rating,
      games: data.games,
      wins: data.wins,
      losses: data.losses,
      nextChangeAt: nextUsernameChangeAt(data.username_changed_at),
    },
    { headers },
  );
}

/** Account owner only. The database profile, not mutable Auth metadata, is canonical. */
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
      .select(columns)
      .eq("user_id", user.id)
      .single();
    if (readError || !data) throw new Error("Profile unavailable");
    return response(data);
  } catch {
    return Response.json(
      { error: "Could not load account identity. Refresh to retry." },
      { status: 503, headers },
    );
  }
}

/** Update exactly one account-owned field. Database uniqueness and cooldown are authoritative. */
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
    const payload = parseIdentityMutation(parsed.value);
    if (!payload)
      return Response.json(
        {
          error:
            "Use 3–20 letters, numbers or underscores for your username, or change visibility separately. Refresh older settings pages.",
        },
        { status: 400, headers },
      );
    const admin = createAdminClient();
    if ("username" in payload && usernameContentProblem(payload.username))
      return Response.json({ error: USERNAME_CONTENT_ERROR }, { status: 400, headers });
    const patch =
      "username" in payload
        ? { username: payload.username }
        : { is_anonymous: payload.isAnonymous };
    const { data, error: writeError } = await admin
      .from("ranked_leaderboard_profiles")
      .update(patch)
      .eq("user_id", user.id)
      .select(columns)
      .single();
    if (writeError?.code === "PT422")
      return Response.json({ error: USERNAME_CONTENT_ERROR }, { status: 400, headers });
    if (writeError?.code === "23505")
      return Response.json(
        { error: "That username is unavailable." },
        { status: 409, headers },
      );
    if (writeError?.code === "PT409")
      return Response.json(
        { error: "You can change your username once every 30 days." },
        { status: 409, headers },
      );
    if (writeError || !data) throw new Error("Profile update unavailable");
    return response(data);
  } catch {
    return Response.json(
      { error: "Could not save account settings. Refresh and try again." },
      { status: 503, headers },
    );
  }
}
