"use client";

import Link from "next/link";
import { Award, CircleHelp, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { calculateLevelProgress } from "@/lib/levels/progression";
import { loadPlayerLevel, type PlayerLevelLookup } from "@/lib/levels/repository";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type LevelState =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "ready"; totalXp: number }
  | { kind: "unavailable" };

export function ProfileLevelCard({ compact = false }: { compact?: boolean } = {}) {
  const [state, setState] = useState<LevelState>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    let revision = 0;
    async function refresh() {
      const current = ++revision;
      try {
        const result: PlayerLevelLookup = await loadPlayerLevel();
        if (!live || current !== revision) return;
        setState(
          result.state === "guest"
            ? { kind: "guest" }
            : {
                kind: "ready",
                totalXp: result.totalXp,
              },
        );
      } catch {
        if (live && current === revision) setState({ kind: "unavailable" });
      }
    }
    void refresh();

    const client = getSupabaseBrowserClient();
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    const subscription = client?.auth.onAuthStateChange((event) => {
      if (
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED" &&
        event !== "INITIAL_SESSION"
      )
        return;
      // Invalidate old account reads immediately; defer new Auth calls outside its callback.
      revision++;
      setState({ kind: "loading" });
      clearTimeout(authTimer);
      authTimer = setTimeout(() => {
        if (live) void refresh();
      }, 0);
    });
    window.addEventListener("focus", refresh);
    window.addEventListener("ai-coach:xp-updated", refresh);
    return () => {
      live = false;
      revision++;
      clearTimeout(authTimer);
      subscription?.data.subscription.unsubscribe();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("ai-coach:xp-updated", refresh);
    };
  }, []);

  const progress = useMemo(
    () => (state.kind === "ready" ? calculateLevelProgress(state.totalXp) : null),
    [state],
  );

  if (compact) {
    if (!progress) return null;
    return (
      <section className="profile-level-compact" aria-label="Account level progress">
        <div className="profile-level-compact-label">
          <strong>LEVEL {progress.level.toLocaleString()}</strong>
          <span>LEVEL {(progress.level + 1).toLocaleString()}</span>
        </div>
        <div
          className="profile-level-progress-track"
          role="progressbar"
          aria-label="XP toward next player level"
          aria-valuemin={0}
          aria-valuemax={progress.xpPerLevel}
          aria-valuenow={progress.xpIntoLevel}
        >
          <span style={{ width: `${progress.percent}%` }} />
        </div>
        <div className="profile-level-compact-label profile-level-compact-values">
          <span>
            {progress.xpIntoLevel.toLocaleString()} /{" "}
            {progress.xpPerLevel.toLocaleString()} XP
          </span>
          <span>{progress.xpToNextLevel.toLocaleString()} XP remaining</span>
        </div>
      </section>
    );
  }

  return (
    <section className="profile-level-card" aria-labelledby="profile-level-title">
      <div className="profile-level-header">
        <div className="profile-level-heading">
          <span className="profile-level-icon">
            <Trophy size={25} aria-hidden="true" />
          </span>
          <div>
            <span className="profile-level-eyebrow">ACCOUNT PROGRESSION</span>
            <h2 id="profile-level-title">Player Level</h2>
          </div>
        </div>
        <span className="profile-level-verified">
          <ShieldCheck size={15} aria-hidden="true" /> Saved account XP
        </span>
      </div>

      {state.kind === "loading" && (
        <p className="profile-level-status" role="status">
          Loading account progression…
        </p>
      )}
      {state.kind === "unavailable" && (
        <div className="profile-level-message" role="alert">
          <CircleHelp size={19} aria-hidden="true" />
          <div>
            <strong>Progression is not available yet.</strong>
            <p>
              Your XP has not been changed. This feature requires the profile-level
              database migration.
            </p>
          </div>
        </div>
      )}
      {state.kind === "guest" && (
        <div className="profile-level-message">
          <Award size={23} aria-hidden="true" />
          <div>
            <strong>Sign in to start earning account XP.</strong>
            <p>
              Every 1,000 XP earns a level. Ranked and eligible account-recorded Practice
              games award XP. Guest games must be synced to earn eligible rewards.
            </p>
            <Link href="/sign-in" className="profile-level-sign-in">
              Sign in
            </Link>
          </div>
        </div>
      )}
      {progress && (
        <div className="profile-level-content">
          <div className="profile-level-stat-row">
            <div className="profile-level-number">
              <span className="profile-level-number-icon">
                <Sparkles size={19} aria-hidden="true" />
              </span>
              <div>
                <span>Current level</span>
                <strong>{progress.level.toLocaleString()}</strong>
              </div>
            </div>
            <div className="profile-level-total">
              <span>Lifetime account XP</span>
              <strong>{progress.totalXp.toLocaleString()} XP</strong>
            </div>
          </div>
          <div className="profile-level-progress-heading">
            <span>Progress to Level {(progress.level + 1).toLocaleString()}</span>
            <strong>
              {progress.xpIntoLevel.toLocaleString()} /{" "}
              {progress.xpPerLevel.toLocaleString()} XP
            </strong>
          </div>
          <div
            className="profile-level-progress-track"
            role="progressbar"
            aria-label="XP toward next player level"
            aria-valuemin={0}
            aria-valuemax={progress.xpPerLevel}
            aria-valuenow={progress.xpIntoLevel}
          >
            <span style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="profile-level-caption">
            {progress.xpToNextLevel.toLocaleString()} XP until Level{" "}
            {(progress.level + 1).toLocaleString()}
            <span aria-hidden="true"> · </span> Ranked and Practice rewards
          </p>
        </div>
      )}
      <p className="profile-level-disclaimer">
        Account levels are separate from competitive Ranked RP. Practice XP is capped and
        separate from competitive rating.
      </p>
    </section>
  );
}
