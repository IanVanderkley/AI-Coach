"use client";

import { Award, CircleHelp, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { loadRankedMatchXpReceipt } from "@/lib/levels/repository";

type ReceiptState =
  | { kind: "loading" }
  | { kind: "earned"; amount: number; outcome: "won" | "lost" }
  | { kind: "missing" }
  | { kind: "unavailable" };

export function RankedMatchXpReceipt({
  matchId,
  expectedOutcome,
}: {
  matchId: string;
  expectedOutcome: "won" | "lost";
}) {
  const [state, setState] = useState<ReceiptState>({ kind: "loading" });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    async function readReceipt() {
      setState({ kind: "loading" });
      try {
        const result = await loadRankedMatchXpReceipt(matchId);
        if (!active) return;
        if (result.state === "earned") {
          if (result.outcome === expectedOutcome)
            window.dispatchEvent(new Event("ai-coach:xp-updated"));
          // Refuse to display any receipt that disagrees with the verified game result.
          setState(
            result.outcome === expectedOutcome
              ? { kind: "earned", amount: result.amount, outcome: result.outcome }
              : { kind: "unavailable" },
          );
        } else {
          setState({ kind: result.state === "missing" ? "missing" : "unavailable" });
        }
      } catch {
        if (active) setState({ kind: "unavailable" });
      }
    }
    void readReceipt();
    return () => {
      active = false;
    };
  }, [matchId, expectedOutcome, revision]);

  return (
    <section className="ranked-match-xp-receipt" aria-label="Match XP reward">
      <div className="ranked-match-xp-heading">
        <span>
          <Award size={18} aria-hidden="true" /> Match XP reward
        </span>
        {state.kind === "earned" && (
          <span className="ranked-match-xp-verified">
            <ShieldCheck size={15} aria-hidden="true" /> Database verified
          </span>
        )}
      </div>
      {state.kind === "loading" && <p role="status">Checking saved match reward…</p>}
      {state.kind === "earned" && (
        <div className="ranked-match-xp-earned" role="status">
          <strong>+{state.amount.toLocaleString()} XP</strong>
          <span>{state.amount === 0 ? "Loss did not qualify for XP (15 seconds and 3 distinct reveal/chord positions required)." : state.outcome === "won" ? "Verified victory" : "Verified loss"}</span>
        </div>
      )}
      {state.kind === "missing" && (
        <p className="ranked-match-xp-note" role="status">
          No saved XP receipt for this match. Games finished before the reward migration
          are not paid retroactively.
        </p>
      )}
      {state.kind === "unavailable" && (
        <p className="ranked-match-xp-note" role="alert">
          <CircleHelp size={16} aria-hidden="true" /> Match XP could not be verified. Your
          balance has not been changed by this display.
        </p>
      )}
      {(state.kind === "missing" || state.kind === "unavailable") && (
        <button
          type="button"
          className="ranked-match-xp-refresh"
          onClick={() => setRevision((old) => old + 1)}
        >
          <RefreshCw size={14} aria-hidden="true" /> Retry match XP
        </button>
      )}
    </section>
  );
}
