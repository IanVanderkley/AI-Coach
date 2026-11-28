"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { RankEmblem } from "@/components/ranked/rank-emblem";
import { rankDefinitionsForPolicy } from "@/lib/leaderboard/rank-display";
import {
  parseRankedLobbyRating,
  rankedLobbyModel,
  type RankedLobbyRating,
} from "@/lib/leaderboard/rank-lobby";
import styles from "./ranked-lobby.module.css";

export function RankedLobby() {
  const [value, setValue] = useState<RankedLobbyRating | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setValue(null);
    setFailed(false);
    void (async () => {
      try {
        const response = await fetch("/api/ranked/lobby-rating", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Rating unavailable");
        const parsed = parseRankedLobbyRating(await response.json());
        if (!controller.signal.aborted) setValue(parsed);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    })();
    return () => controller.abort();
  }, [revision]);

  const model = value ? rankedLobbyModel(value) : null;
  const RANK_DEFINITIONS = rankDefinitionsForPolicy(value?.policyVersion ?? 3);
  return (
    <section
      className={styles.lobby}
      aria-labelledby="ranked-lobby-title"
      style={{ "--rank-accent": model?.current.color ?? "#c0cad8" } as CSSProperties}
    >
      <header className={styles.heading}>
        <div>
          <p>COMPETITIVE PROGRESSION</p>
          <h2 id="ranked-lobby-title">Your Ranked journey</h2>
        </div>
        <Link href="/faq#ranked">Ranked rules</Link>
      </header>
      {value && model ? (
        <>
          <div className={styles.hero}>
            <RankEmblem
              rating={value.rating}
              size={160}
              decorative
              policyVersion={value.policyVersion}
            />
            <div className={styles.current}>
              <p className={styles.eyebrow}>CURRENT RANK</p>
              <h3>{model.current.label}</h3>
              <strong className={styles.elo}>{value.rating.toLocaleString()} Elo</strong>
              {model.current.progress !== null &&
              model.current.eloToPromotion !== null ? (
                <>
                  <div
                    className={styles.progress}
                    role="progressbar"
                    aria-label="Progress toward next division"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(model.current.progress * 100)}
                  >
                    <span style={{ width: `${model.current.progress * 100}%` }} />
                  </div>
                  <p className={styles.muted}>
                    {model.current.eloToPromotion} Elo to {model.nextRank}
                  </p>
                </>
              ) : (
                <p className={styles.muted}>Highest rank reached</p>
              )}
            </div>
            <div className={styles.peak}>
              <p className={styles.eyebrow}>HIGHEST RECORDED RANK</p>
              <RankEmblem
                rating={value.highestRating}
                size={72}
                decorative
                policyVersion={value.policyVersion}
              />
              <strong>{model.highest.label}</strong>
              <span>{value.highestRating.toLocaleString()} Elo</span>
            </div>
          </div>
          <div
            className={styles.journeyScroll}
            tabIndex={0}
            aria-label="Rank milestones; scroll horizontally on small screens"
          >
            <div className={styles.journey}>
              <div className={styles.track} aria-hidden="true">
                <span style={{ width: `${model.journeyPercent}%` }} />
                <i style={{ left: `${model.journeyPercent}%` }} />
              </div>
              <ol className={styles.milestones}>
                {RANK_DEFINITIONS.map((rank, index) => (
                  <li
                    key={rank.name}
                    data-current={index === model.index}
                    data-upcoming={index > model.index}
                    aria-current={index === model.index ? "step" : undefined}
                    style={{ "--milestone-color": rank.color } as CSSProperties}
                  >
                    <RankEmblem
                      rating={rank.min}
                      policyVersion={value.policyVersion}
                      size={88}
                      showDivision={false}
                      decorative
                    />
                    <span className={styles.dot} aria-hidden="true" />
                    <strong>{rank.name}</strong>
                    <small>{rank.min.toLocaleString()} Elo</small>
                    <small>
                      {rank.divisions === 5
                        ? "V – I"
                        : rank.divisions === 3
                          ? "III – I"
                          : "Top rank"}
                    </small>
                    {index === model.index && <span className={styles.you}>YOU</span>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </>
      ) : failed ? (
        <div className={styles.unavailable} role="status">
          <p>Rank progression is unavailable. Your match controls are unaffected.</p>
          <button type="button" onClick={() => setRevision((n) => n + 1)}>
            Retry rank details
          </button>
        </div>
      ) : (
        <p className={styles.unavailable} role="status">
          Loading your saved rating…
        </p>
      )}
    </section>
  );
}
