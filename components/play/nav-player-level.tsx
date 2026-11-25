"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { calculateLevelProgress, type LevelProgress } from "@/lib/levels/progression";
import { loadPlayerLevel } from "@/lib/levels/repository";

type LoadedLevel = { userId: string; progress: LevelProgress };

/** Read-only saved account progression; never estimates or awards XP. */
export function NavPlayerLevel({
  userId,
  pathname,
}: {
  userId: string;
  pathname: string;
}) {
  const [loaded, setLoaded] = useState<LoadedLevel | null>(null);
  useEffect(() => {
    let active = true;
    let revision = 0;
    setLoaded(null);
    async function refresh() {
      const current = ++revision;
      try {
        const result = await loadPlayerLevel(userId);
        if (!active || current !== revision) return;
        if (result.state !== "ready") {
          setLoaded(null);
          return;
        }
        setLoaded({ userId, progress: calculateLevelProgress(result.totalXp) });
      } catch {
        if (active && current === revision) setLoaded(null);
      }
    }
    void refresh();
    window.addEventListener("ai-coach:xp-updated", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      revision++;
      window.removeEventListener("ai-coach:xp-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [userId, pathname]);

  if (!loaded || loaded.userId !== userId) return null;
  const { progress } = loaded;
  const description = `Level ${progress.level.toLocaleString()} · ${progress.xpIntoLevel.toLocaleString()} / ${progress.xpPerLevel.toLocaleString()} XP · ${Math.floor(progress.percent)}% to next level`;
  return (
    <Link
      href="/profile"
      className="nav-player-level nav-level-ring"
      aria-label={description}
      title={description}
    >
      <svg
        viewBox="0 0 52 52"
        aria-hidden="true"
        focusable="false"
        className="nav-level-ring-svg"
      >
        <circle className="nav-level-ring-track" cx="26" cy="26" r="23" />
        <circle
          className="nav-level-ring-fill"
          cx="26"
          cy="26"
          r="23"
          pathLength={100}
          strokeDasharray={`${progress.percent} 100`}
          transform="rotate(-90 26 26)"
          style={{ visibility: progress.percent === 0 ? "hidden" : "visible" }}
        />
      </svg>
      <span className="nav-level-ring-label">
        <small>LVL</small>
        <strong>{progress.level.toLocaleString()}</strong>
      </span>
    </Link>
  );
}
