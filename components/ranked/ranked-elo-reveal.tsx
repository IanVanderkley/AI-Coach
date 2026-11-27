"use client";

import { useEffect, useState } from "react";
import { eloRevealFrame } from "@/lib/leaderboard/elo-reveal";

/** Mount once per verified receipt. Accessible text always describes the final result. */
export function RankedEloReveal({ before, after, deltaLabel }: {
  before: number;
  after: number;
  deltaLabel: string;
}) {
  const [frame, setFrame] = useState(() => eloRevealFrame(before, after, 0));
  useEffect(() => {
    let animation = 0;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => {
      window.cancelAnimationFrame(animation);
      setFrame({ rating: after, done: true });
    };
    const motionChanged = () => { if (motion.matches) finish(); };
    motion.addEventListener("change", motionChanged);
    if (motion.matches || before === after) finish();
    else {
      let start: number | undefined;
      const tick = (now: number) => {
        start ??= now;
        const next = eloRevealFrame(before, after, now - start);
        setFrame(next);
        if (!next.done) animation = window.requestAnimationFrame(tick);
      };
      animation = window.requestAnimationFrame(tick);
    }
    return () => {
      window.cancelAnimationFrame(animation);
      motion.removeEventListener("change", motionChanged);
    };
  }, [before, after]);
  const tone = after > before ? "gain" : after < before ? "loss" : "neutral";
  return (
    <div className="ranked-elo-reveal" data-tone={tone} data-settled={frame.done}>
      <span className="sr-only" role="status">Rating: {before.toLocaleString()} to {after.toLocaleString()} Elo. Change: {deltaLabel} Elo.</span>
      <div className="ranked-elo-value" aria-hidden="true">
        <strong>{frame.rating.toLocaleString()} <small>Elo</small></strong>
        <span className="ranked-elo-delta">{deltaLabel} Elo</span>
      </div>
    </div>
  );
}
