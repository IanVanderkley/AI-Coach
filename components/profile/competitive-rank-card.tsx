"use client";

import Link from "next/link";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { RankEmblem } from "@/components/ranked/rank-emblem";
import {
  parseRankedLobbyRating,
  rankedLobbyModel,
  type RankedLobbyRating,
} from "@/lib/leaderboard/rank-lobby";
import styles from "./competitive-rank-card.module.css";

type RankState =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "unavailable" }
  | { kind: "ready"; rating: RankedLobbyRating };

/** Same owner-scoped saved Elo and highest recorded rating as the Ranked lobby. */
export function CompetitiveRankCard() {
  const [state, setState] = useState<RankState>({ kind: "loading" });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    void (async () => {
      try {
        const response = await fetch("/api/ranked/lobby-rating", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          setState({ kind: "guest" });
          return;
        }
        if (!response.ok) throw new Error("Rank unavailable.");
        const rating = parseRankedLobbyRating(await response.json());
        if (!controller.signal.aborted) setState({ kind: "ready", rating });
      } catch {
        if (!controller.signal.aborted) setState({ kind: "unavailable" });
      }
    })();
    return () => controller.abort();
  }, [revision]);

  const saved = state.kind === "ready" ? state.rating : null;
  const model = saved ? rankedLobbyModel(saved) : null;

  return (
    <section className={styles.card} aria-label="Competitive Ranked progression">
      <div className={styles.heading}>
        <div>
          <h2>Ranked career</h2>
        </div>
        <div className={styles.links}>
          <Link className={styles.play} href="/ranked">
            Play Ranked
          </Link>
        </div>
      </div>
      {state.kind === "loading" && <p role="status">Loading saved rank…</p>}
      {state.kind === "guest" && (
        <p role="status">
          <Link href="/sign-in">Sign in</Link> to see your competitive rank.
        </p>
      )}
      {state.kind === "unavailable" && (
        <div className={styles.error}>
          <p role="alert">Rank progression is unavailable. No rating has been assumed.</p>
          <button type="button" onClick={() => setRevision((n) => n + 1)}>
            <RefreshCw size={14} aria-hidden="true" /> Retry rank details
          </button>
        </div>
      )}
      {saved && model && (
        <div className={styles.body}>
          <div className={styles.current}>
            <RankEmblem
              rating={saved.rating}
              size={144}
              decorative
              policyVersion={saved.policyVersion}
            />
            <div className={styles.details}>
              <span className={styles.label}>CURRENT RANK</span>
              <h3 style={{ color: model.current.color }}>{model.current.label}</h3>
              <strong>{saved.rating.toLocaleString()} Elo</strong>
              {model.current.progress !== null ? (
                <>
                  <progress
                    className={styles.progress}
                    style={{ "--rank-color": model.current.color } as CSSProperties}
                    max={100}
                    value={Math.round(model.current.progress * 100)}
                    aria-label="Progress toward next competitive division"
                  />
                  <span className={styles.caption}>
                    {model.current.eloToPromotion} Elo to {model.nextRank}
                  </span>
                </>
              ) : (
                <span className={styles.caption}>Highest competitive rank</span>
              )}
            </div>
          </div>
          <div className={styles.highest}>
            <RankEmblem
              rating={saved.highestRating}
              size={108}
              decorative
              policyVersion={saved.policyVersion}
            />
            <div className={styles.details}>
              <span className={styles.label}>HIGHEST RECORDED RANK</span>
              <h3 style={{ color: model.highest.color }}>{model.highest.label}</h3>
              <strong>{saved.highestRating.toLocaleString()} Elo</strong>
            </div>
          </div>
          <span className={styles.verified}>
            <ShieldCheck size={14} aria-hidden="true" /> Verified rating history
          </span>
        </div>
      )}
    </section>
  );
}
