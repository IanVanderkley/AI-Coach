"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import {
  formatDisplaySeconds,
  rankedDisplaySeconds,
  type RankedClockAnchor,
} from "@/lib/ranked/display-clock";

type RankedClockProps = {
  clock: RankedClockAnchor | null | undefined;
  firstMoveDone: boolean;
  status: "active" | "won" | "lost";
  durationMs?: number;
};

// Isolate the ticking value so the whole board is not rerendered each second.
export function RankedClock({
  clock,
  firstMoveDone,
  status,
  durationMs,
}: RankedClockProps) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (status !== "active" || !clock) return;
    const update = () => setNow(performance.now());
    update();
    const interval = window.setInterval(update, 250);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("pageshow", update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pageshow", update);
    };
  }, [clock, status]);

  const active = status === "active";
  const seconds = active
    ? !firstMoveDone
      ? 0
      : clock
        ? rankedDisplaySeconds(clock, now)
        : null
    : typeof durationMs === "number" &&
        Number.isSafeInteger(durationMs) &&
        durationMs >= 0
      ? Math.floor(durationMs / 1000)
      : null;
  return (
    <div title="Ranked time includes time away after the first reveal. The final result uses server time.">
      <Timer size={17} aria-hidden="true" />
      <dt>{active ? "Time (est.)" : "Server time"}</dt>
      <dd>{seconds === null ? "—" : formatDisplaySeconds(seconds)}</dd>
    </div>
  );
}
