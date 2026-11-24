"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { calculateLevelProgress } from "@/lib/levels/progression";
import { loadPlayerLevel } from "@/lib/levels/repository";

type LoadedLevel = { userId: string; level: number };

/** Account-owned level indicator; the navbar never calculates or awards XP. */
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
    setLoaded(null);
    void loadPlayerLevel()
      .then((result) => {
        if (!active || result.state !== "ready") return;
        setLoaded({ userId, level: calculateLevelProgress(result.totalXp).level });
      })
      .catch(() => {
        if (active) setLoaded(null);
      });
    return () => {
      active = false;
    };
  }, [userId, pathname]);

  if (!loaded || loaded.userId !== userId) return null;

  return (
    <Link
      href="/profile"
      className="nav-player-level"
      aria-label={`Player level ${loaded.level}`}
      title="Verified account XP level"
    >
      LVL {loaded.level.toLocaleString()}
    </Link>
  );
}
