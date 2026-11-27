"use client";

import Link from "next/link";
import {
  Flag,
  Loader2,
  RefreshCw,
  Play,
  MousePointer2,
  Bomb,
  History,
} from "lucide-react";
import styles from "./ranked-layout.module.css";
import { FeedbackNotice, type FeedbackTone } from "@/components/ui/feedback-notice";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGameViewportScroll } from "@/components/play/use-game-viewport-scroll";
import type { CSSProperties } from "react";
import {
  appendRankedIntent,
  MAX_QUEUED_RANKED_MOVES,
  takeRankedIntent,
  type RankedMoveIntent,
} from "@/lib/ranked/input-queue";

import { Navbar } from "@/components/play/navbar";
import { BoardControlsGuide } from "@/components/play/board-controls-guide";
import { RankedResultDialog } from "@/components/ranked/ranked-result-dialog";
import { RankedLadderOverview } from "@/components/ranked/ranked-ladder-overview"; // AI_COACH_RANKED_LADDER_OVERVIEW_V1
import { RankedLobby } from "@/components/ranked/ranked-lobby";
import { RankedClock } from "@/components/ranked/ranked-clock";
import {
  RankedReviewCell,
  RankedReviewLegend,
} from "@/components/ranked/ranked-review-cell";
import {
  buildRankedBoardReview,
  type RankedBoardReview,
} from "@/lib/ranked/board-review";
import {
  firstRevealClock,
  recoveredRankedClock,
  type RankedClockAnchor,
} from "@/lib/ranked/display-clock";
import { buildRankedResult } from "@/lib/ranked/result-summary"; // AI_COACH_RANKED_RESULT_DIALOG_V1

type Position = {
  row: number;
  column: number;
};

type RevealedCell = Position & {
  adjacentMines: number;
};

type RankedBoard = {
  matchId: string;
  status: "active" | "won" | "lost";
  rows: number;
  columns: number;
  mineCount: number;
  moveCount: number;
  firstMoveDone: boolean;
  startedAt?: string | null;
  // Display only: never supplied to any Ranked move API.
  clock?: RankedClockAnchor | null;
  review?: RankedBoardReview | null;
  revealedCells: RevealedCell[];
  flaggedCells: Position[];
  flagCount: number;
  durationMs?: number;
};

type RevealResult = {
  matchId: string;
  status: "active" | "won" | "lost";
  moveCount: number;
  revealedCells: RevealedCell[];
  durationMs?: number;
};

const numberClasses: Record<number, string> = {
  1: "number-one",
  2: "number-two",
  3: "number-three",
  4: "number-four",
  5: "number-five",
  6: "number-six",
  7: "number-seven",
  8: "number-eight",
};

// AI_COACH_RANKED_CACHED_RECOVERY_V1: session-only match ID hint; no hidden board or account data stored.
// The server validates match ownership on EVERY use of this ID.
const RANKED_MATCH_STORAGE_KEY = "ai-coach:ranked:last-active-match:v1";
const RANKED_MATCH_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readRememberedMatchId(): string | null {
  try {
    const value = window.sessionStorage.getItem(RANKED_MATCH_STORAGE_KEY);
    return value && RANKED_MATCH_ID_PATTERN.test(value) ? value : null;
  } catch {
    return null;
  }
}

function rememberMatchId(value: string | null) {
  try {
    if (value && RANKED_MATCH_ID_PATTERN.test(value)) {
      window.sessionStorage.setItem(RANKED_MATCH_STORAGE_KEY, value);
    } else {
      window.sessionStorage.removeItem(RANKED_MATCH_STORAGE_KEY);
    }
  } catch {
    // Session storage may be disabled; normal recovery still works.
  }
}

type RankedNotice = {
  tone: FeedbackTone;
  title: string;
  description: string;
  signIn?: boolean;
};
const RECOVERED_NOTICE: RankedNotice = {
  tone: "success",
  title: "Board refreshed",
  description:
    "Your board has been synchronized. Check whether your move was applied before continuing. If the match ended, see your match history in Coaching.",
};

export default function RankedPage() {
  const [board, setBoard] = useState<RankedBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submittingMove, setSubmittingMove] = useState(false);
  // AI_COACH_RANKED_INPUT_FEEDBACK_V1: only visual feedback; board state remains server-authoritative.
  const [pendingCell, setPendingCell] = useState<{
    row: number;
    column: number;
    action: "reveal" | "flag" | "chord";
  } | null>(null);
  const [inputMode, setInputMode] = useState<"reveal" | "flag">("reveal");
  const [noMatch, setNoMatch] = useState(false);
  const [resumeRequired, setResumeRequired] = useState(true);
  const [notice, setNotice] = useState<RankedNotice | null>(null);
  const [dismissedResultMatchId, setDismissedResultMatchId] = useState<string | null>(
    null,
  );

  const gamePanelRef = useRef<HTMLElement | null>(null);
  const [gameViewRevision, setGameViewRevision] = useState(0);
  useGameViewportScroll(
    gamePanelRef,
    !loading && !resumeRequired && board?.status === "active"
      ? `${board.matchId}:${gameViewRevision}`
      : null,
  );

  // Prevent multiple requests from being sent at the same time.
  const moveInFlight = useRef(false);
  const [queuedMoves, setQueuedMoves] = useState<readonly RankedMoveIntent[]>([]);
  const queueRef = useRef<readonly RankedMoveIntent[]>([]);
  const activeMoveRef = useRef<RankedMoveIntent | null>(null);
  const sentRevisionRef = useRef<{ matchId: string; revision: number } | null>(null);
  const recoveringRef = useRef(false);
  const clearQueuedMoves = useCallback(() => {
    if (queueRef.current.length === 0) return;
    queueRef.current = [];
    setQueuedMoves([]);
  }, []);
  // AI_COACH_RANKED_SINGLE_INITIAL_LOAD_V1: suppress React Strict Mode's duplicate mount effect.
  const initialRecoveryRequested = useRef(false);

  // Restore the player's visible board from Supabase.
  const loadBoard = useCallback(async () => {
    recoveringRef.current = true;
    clearQueuedMoves();
    sentRevisionRef.current = null;
    setLoading(true);
    setNotice(null);

    try {
      const rememberedMatchId = readRememberedMatchId();
      const response = await fetch("/api/ranked/matches/current", {
        cache: "no-store",
        ...(rememberedMatchId
          ? { headers: { "X-Ranked-Known-Match": rememberedMatchId } }
          : {}),
      });

      if (response.status === 404) {
        rememberMatchId(null);
        setBoard(null);
        setNoMatch(true);
        return true;
      }

      if (response.status === 401) {
        rememberMatchId(null);
        setBoard(null);
        setNoMatch(false);
        setNotice({
          tone: "info",
          title: "Sign in to play Ranked",
          description: "Sign in to save your match and earn Ranked rewards.",
          signIn: true,
        });
        return false;
      }

      if (!response.ok) {
        throw new Error("Could not load your Ranked match.");
      }

      const data: RankedBoard = await response.json();
      rememberMatchId(data.status === "active" ? data.matchId : null);

      setBoard({
        ...data,
        review: null,
        clock: data.firstMoveDone
          ? recoveredRankedClock(
              data.startedAt,
              response.headers.get("date"),
              performance.now(),
            )
          : null,
      });
      setNoMatch(false);
      return true;
    } catch {
      setBoard(null);
      setNoMatch(false);
      setNotice({
        tone: "error",
        title: "Ranked is unavailable",
        description: "We could not load your match. Refresh the board to try again.",
      });
      return false;
    } finally {
      recoveringRef.current = false;
      setLoading(false);
    }
  }, [clearQueuedMoves]);

  // Load the saved game when the page opens.
  useEffect(() => {
    if (initialRecoveryRequested.current) return;
    initialRecoveryRequested.current = true;
    void loadBoard();
  }, [loadBoard]);

  // Create a new match or resume an active one.
  async function startMatch() {
    clearQueuedMoves();
    sentRevisionRef.current = null;
    setStarting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/ranked/matches", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Could not start a Ranked match.");
      }

      setBoard(null);
      rememberMatchId(null);
      setInputMode("reveal");
      setGameViewRevision((revision) => revision + 1);
      setResumeRequired(false);
      await loadBoard();
    } catch {
      setNotice({
        tone: "error",
        title: "Could not start match",
        description:
          "Try again in a moment or refresh your board to recover an active match.",
      });
    } finally {
      setStarting(false);
    }
  }

  // Send a reveal request to the server.
  async function revealCell(row: number, column: number) {
    if (!board || board.status !== "active" || moveInFlight.current) {
      return;
    }

    moveInFlight.current = true;
    activeMoveRef.current = { matchId: board.matchId, row, column, action: "reveal" };
    sentRevisionRef.current = { matchId: board.matchId, revision: board.moveCount };
    setPendingCell({ row, column, action: "reveal" });
    setSubmittingMove(true);
    setNotice(null);

    try {
      const requestStartedAtMs = performance.now();
      const response = await fetch("/api/ranked/matches/reveal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId: board.matchId,
          expectedMoveCount: board.moveCount,
          row,
          column,
          firstMoveDone: board.firstMoveDone,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not reveal the selected square.");
      }

      const verifiedResult = result as RevealResult;

      if (
        verifiedResult.matchId !== board.matchId ||
        !Array.isArray(verifiedResult.revealedCells) ||
        verifiedResult.moveCount !== board.moveCount + 1 ||
        !["active", "won", "lost"].includes(verifiedResult.status)
      ) {
        throw new Error("Invalid response from the Ranked server.");
      }

      const observedClock = board.firstMoveDone
        ? null
        : firstRevealClock(requestStartedAtMs, performance.now());

      // Merge the newly revealed cells with the existing board.
      // Supabase controls the mines and decides wins or losses.
      setBoard((current) => {
        if (!current || current.matchId !== board.matchId) {
          return current;
        }

        const revealed = new Map<string, RevealedCell>();

        for (const cell of current.revealedCells) {
          revealed.set(`${cell.row}-${cell.column}`, cell);
        }

        for (const cell of verifiedResult.revealedCells) {
          revealed.set(`${cell.row}-${cell.column}`, cell);
        }

        return {
          ...current,
          revealedCells: Array.from(revealed.values()),
          moveCount: verifiedResult.moveCount,
          status: verifiedResult.status,
          durationMs: verifiedResult.durationMs,
          review: buildRankedBoardReview(
            current,
            verifiedResult,
            Array.from(revealed.values()),
          ),
          firstMoveDone: true,
          clock: current.clock ?? observedClock,
        };
      });
    } catch {
      // A failed response does not prove the transaction failed. Never replay it.
      const recovered = await loadBoard();
      if (recovered) {
        setNotice(RECOVERED_NOTICE);
      }
    } finally {
      setPendingCell(null);
      activeMoveRef.current = null;
      moveInFlight.current = false;
      setSubmittingMove(false);
    }
  }

  // Place or remove a flag through the server-controlled Ranked game.
  async function toggleFlag(row: number, column: number) {
    if (!board || board.status !== "active" || moveInFlight.current) {
      return;
    }

    // Ranked requires the first reveal before players can place flags.
    if (!board.firstMoveDone) {
      setNotice({
        tone: "warning",
        title: "Reveal a square first",
        description: "Open your first square to unlock flagging.",
      });
      return;
    }

    // Revealed squares cannot be flagged.
    if (board.revealedCells.some((cell) => cell.row === row && cell.column === column)) {
      return;
    }

    moveInFlight.current = true;
    activeMoveRef.current = { matchId: board.matchId, row, column, action: "flag" };
    sentRevisionRef.current = { matchId: board.matchId, revision: board.moveCount };
    setPendingCell({ row, column, action: "flag" });
    setSubmittingMove(true);
    setNotice(null);

    try {
      const response = await fetch("/api/ranked/matches/flag", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId: board.matchId,
          expectedMoveCount: board.moveCount,
          row,
          column,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not update the flag.");
      }

      if (
        result.matchId !== board.matchId ||
        result.row !== row ||
        result.column !== column ||
        typeof result.flagged !== "boolean" ||
        typeof result.flagCount !== "number" ||
        result.moveCount !== board.moveCount + 1
      ) {
        throw new Error("Invalid response from the Ranked server.");
      }

      // Apply the server's flag result to the visible board.
      setBoard((current) => {
        if (!current || current.matchId !== board.matchId) {
          return current;
        }

        const remainingFlags = current.flaggedCells.filter(
          (cell) => cell.row !== row || cell.column !== column,
        );

        return {
          ...current,
          flaggedCells: result.flagged
            ? [...remainingFlags, { row, column }]
            : remainingFlags,
          flagCount: result.flagCount,
          moveCount: result.moveCount,
        };
      });
    } catch {
      // A failed response does not prove the transaction failed. Never replay it.
      const recovered = await loadBoard();
      if (recovered) {
        setNotice(RECOVERED_NOTICE);
      }
    } finally {
      setPendingCell(null);
      activeMoveRef.current = null;
      moveInFlight.current = false;
      setSubmittingMove(false);
    }
  }

  // Chord a revealed numbered square using the Ranked server.
  async function chordCell(row: number, column: number) {
    if (!board || board.status !== "active" || moveInFlight.current) {
      return;
    }

    // Only revealed numbers can be chorded.
    const selected = board.revealedCells.find(
      (cell) => cell.row === row && cell.column === column,
    );

    if (!selected || selected.adjacentMines === 0) return;

    // Clicking a revealed number chords naturally, but only when its
    // surrounding flag count matches. The server still verifies everything.
    const neighbors = [] as Position[];
    for (
      let nextRow = Math.max(0, row - 1);
      nextRow <= Math.min(board.rows - 1, row + 1);
      nextRow++
    ) {
      for (
        let nextColumn = Math.max(0, column - 1);
        nextColumn <= Math.min(board.columns - 1, column + 1);
        nextColumn++
      ) {
        if (nextRow !== row || nextColumn !== column) {
          neighbors.push({ row: nextRow, column: nextColumn });
        }
      }
    }

    const flagged = new Set(
      board.flaggedCells.map((cell) => `${cell.row}-${cell.column}`),
    );
    const revealed = new Set(
      board.revealedCells.map((cell) => `${cell.row}-${cell.column}`),
    );
    const flagCount = neighbors.filter((cell) =>
      flagged.has(`${cell.row}-${cell.column}`),
    ).length;
    const hasHiddenNeighbor = neighbors.some((cell) => {
      const key = `${cell.row}-${cell.column}`;
      return !flagged.has(key) && !revealed.has(key);
    });

    if (flagCount !== selected.adjacentMines || !hasHiddenNeighbor) return;

    moveInFlight.current = true;
    activeMoveRef.current = { matchId: board.matchId, row, column, action: "chord" };
    sentRevisionRef.current = { matchId: board.matchId, revision: board.moveCount };
    setPendingCell({ row, column, action: "chord" });
    setSubmittingMove(true);
    setNotice(null);

    try {
      const response = await fetch("/api/ranked/matches/chord", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId: board.matchId,
          expectedMoveCount: board.moveCount,
          row,
          column,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not chord this square.");
      }

      const verifiedResult = result as RevealResult;

      if (
        verifiedResult.matchId !== board.matchId ||
        !Array.isArray(verifiedResult.revealedCells) ||
        verifiedResult.moveCount !== board.moveCount + 1 ||
        !["active", "won", "lost"].includes(verifiedResult.status)
      ) {
        throw new Error("Invalid response from the Ranked server.");
      }

      // Merge only squares that the server says are revealed.
      setBoard((current) => {
        if (!current || current.matchId !== board.matchId) {
          return current;
        }

        const revealed = new Map<string, RevealedCell>();

        for (const cell of current.revealedCells) {
          revealed.set(`${cell.row}-${cell.column}`, cell);
        }

        for (const cell of verifiedResult.revealedCells) {
          revealed.set(`${cell.row}-${cell.column}`, cell);
        }

        return {
          ...current,
          revealedCells: Array.from(revealed.values()),
          moveCount: verifiedResult.moveCount,
          status: verifiedResult.status,
          durationMs: verifiedResult.durationMs,
          review: buildRankedBoardReview(
            current,
            verifiedResult,
            Array.from(revealed.values()),
          ),
        };
      });
    } catch {
      // A failed response does not prove the transaction failed. Never replay it.
      const recovered = await loadBoard();
      if (recovered) {
        setNotice(RECOVERED_NOTICE);
      }
    } finally {
      setPendingCell(null);
      activeMoveRef.current = null;
      moveInFlight.current = false;
      setSubmittingMove(false);
    }
  }

  // Do not dispatch a second move until the revision from the first response is rendered.
  function revisionReady() {
    const sent = sentRevisionRef.current;
    return (
      !!board &&
      (!sent || sent.matchId !== board.matchId || board.moveCount > sent.revision)
    );
  }

  function dispatchIntent(intent: RankedMoveIntent) {
    if (intent.action === "flag") void toggleFlag(intent.row, intent.column);
    else if (intent.action === "chord") void chordCell(intent.row, intent.column);
    else void revealCell(intent.row, intent.column);
  }

  function queueMove(action: RankedMoveIntent["action"], row: number, column: number) {
    if (
      !board ||
      board.status !== "active" ||
      loading ||
      starting ||
      resumeRequired ||
      recoveringRef.current
    )
      return;
    const intent = { matchId: board.matchId, row, column, action };
    // Fast path: the first click still starts its request immediately.
    if (
      !moveInFlight.current &&
      !submittingMove &&
      queueRef.current.length === 0 &&
      revisionReady()
    ) {
      dispatchIntent(intent);
      return;
    }
    const next = appendRankedIntent(queueRef.current, intent, activeMoveRef.current);
    if (next !== queueRef.current) {
      queueRef.current = next;
      setQueuedMoves(next);
    }
  }

  // Runs after the board update commits. The ref prevents duplicate dispatches,
  // including when another render occurs before the pending indicator is painted.
  useEffect(() => {
    if (queueRef.current.length === 0) return;
    if (
      !board ||
      board.status !== "active" ||
      loading ||
      starting ||
      resumeRequired ||
      recoveringRef.current
    ) {
      clearQueuedMoves();
      return;
    }
    if (moveInFlight.current || submittingMove || !revisionReady()) return;
    const { next, remaining } = takeRankedIntent(queueRef.current, board);
    queueRef.current = remaining;
    setQueuedMoves(remaining);
    if (next) dispatchIntent(next);
  });

  // Drop unsent input on background/navigation; never abort a possibly committed move.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") clearQueuedMoves();
    };
    window.addEventListener("pagehide", clearQueuedMoves);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      queueRef.current = [];
      window.removeEventListener("pagehide", clearQueuedMoves);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [clearQueuedMoves]);

  const rankedResult = buildRankedResult(board, dismissedResultMatchId);
  const showLobby =
    !loading && (noMatch || (board?.status === "active" && resumeRequired));

  function returnToLobby() {
    if (starting || submittingMove) return;
    if (board) setDismissedResultMatchId(board.matchId);
    setResumeRequired(true);
    void loadBoard();
  }

  // Build the visible board using only server-provided information.
  const revealed = new Map<string, number>();

  for (const cell of board?.revealedCells ?? []) {
    revealed.set(`${cell.row}-${cell.column}`, cell.adjacentMines);
  }

  const flags = new Set(
    (board?.flaggedCells ?? []).map((cell) => `${cell.row}-${cell.column}`),
  );

  return (
    <>
      <Navbar />

      <main
        className={`page-shell ${showLobby ? styles.lobbyPage : board && !resumeRequired ? `${styles.gameplayPage} ranked-gameplay-page` : ""}`}
        id="main-content"
      >
        <div className="page-heading">
          <div>
            <p className="eyebrow">COMPETE. IMPROVE. CLIMB.</p>
            <h1>
              Ranked<span className="title-period">.</span>
            </h1>
            {!showLobby && <p className="page-subtitle">Intermediate · 16 × 16 · 40 mines</p>}
          </div>
        </div>

        <p>
          <Link href="/">← Back to Practice</Link>
        </p>

        {loading && (
          <FeedbackNotice
            tone="loading"
            title="Loading Ranked match"
            description="Retrieving your latest board from the server."
          />
        )}

        {notice && (
          <FeedbackNotice
            tone={notice.tone}
            title={notice.title}
            description={notice.description}
            action={
              notice.signIn ? (
                <Link href="/sign-in">Sign in</Link>
              ) : (
                <button
                  type="button"
                  disabled={loading || starting || submittingMove}
                  onClick={() => void loadBoard()}
                >
                  <RefreshCw size={14} aria-hidden="true" /> Refresh Ranked board
                </button>
              )
            }
          />
        )}

        {showLobby && (
          <div className={styles.lobbySetup}>
            <RankedLadderOverview />
            <div className={styles.lobbyActions}>
              {noMatch && !loading && (
                <section className={styles.launch} aria-label="Ranked match setup">
                  <button
                    type="button"
                    className={styles.playButton}
                    onClick={startMatch}
                    disabled={starting}
                  >
                    {starting ? (
                      <Loader2 className={styles.spinner} size={24} aria-hidden="true" />
                    ) : (
                      <Play size={24} aria-hidden="true" />
                    )}
                    <span>
                      <strong>
                        {starting ? "STARTING MATCH…" : "PLAY INTERMEDIATE"}
                      </strong>
                      <small>Ranked · 16 × 16 · 40 mines</small>
                    </span>
                  </button>
                </section>
              )}

              {board?.status === "active" && !loading && resumeRequired && (
                <section className={styles.launch} aria-label="Resume Ranked match">
                  <button
                    type="button"
                    className={styles.playButton}
                    disabled={starting || submittingMove}
                    onClick={async () => {
                      if (await loadBoard()) setResumeRequired(false);
                    }}
                  >
                    <History size={24} aria-hidden="true" />
                    <span>
                      <strong>RESUME MATCH</strong>
                      <small>Ranked · Intermediate</small>
                    </span>
                  </button>
                </section>
              )}
            </div>
          </div>
        )}
        {showLobby && <RankedLobby />}

        {board && !loading && (!resumeRequired || board.status !== "active") && (
          <section ref={gamePanelRef} className="game-panel">
            <div className={styles.dashboard}>
              <div className={styles.statusRow}>
                <span className={styles.matchStatus} data-status={board.status}>
                  <span aria-hidden="true" />
                  {board.status === "active"
                    ? "Match in progress"
                    : board.status === "won"
                      ? "Victory"
                      : "Match completed"}
                </span>
                <span className={styles.difficulty}>Ranked · Intermediate</span>
              </div>
              <dl className={styles.stats}>
                <RankedClock
                  clock={board.clock}
                  firstMoveDone={board.firstMoveDone}
                  status={board.status}
                  durationMs={board.durationMs}
                />
                <div>
                  <MousePointer2 size={17} aria-hidden="true" />
                  <dt>Moves</dt>
                  <dd>{board.moveCount}</dd>
                </div>
                <div>
                  <Flag size={17} aria-hidden="true" />
                  <dt>Flags placed</dt>
                  <dd>
                    {board.flagCount} <small>/ {board.mineCount}</small>
                  </dd>
                </div>
                <div>
                  <Bomb size={17} aria-hidden="true" />
                  <dt>Mines left</dt>
                  <dd>{Math.max(0, board.mineCount - board.flagCount)}</dd>
                </div>
              </dl>
            </div>

            {/* Choose what a left-click does. Right-click always toggles a flag. */}
            <div className={styles.controls} role="group" aria-label="Ranked cell action">
              <button
                type="button"
                className={styles.modeButton}
                aria-pressed={inputMode === "reveal"}
                onClick={() => setInputMode("reveal")}
                disabled={board.status !== "active"}
              >
                <MousePointer2 size={17} aria-hidden="true" /> Reveal
              </button>

              <button
                type="button"
                className={styles.modeButton}
                aria-pressed={inputMode === "flag"}
                onClick={() => setInputMode("flag")}
                disabled={board.status !== "active" || !board.firstMoveDone}
              >
                <Flag size={15} aria-hidden="true" /> Flag
              </button>
            </div>

            {/* Fixed minimum height avoids jumping the board during input. */}
            <div className={styles.moveQueueStatus}>
              <span role="status" aria-live="polite">
                {submittingMove && (
                  <>
                    <Loader2 size={14} aria-hidden="true" /> Syncing move…
                  </>
                )}
                {board.status === "active" && queuedMoves.length > 0 && (
                  <span>
                    {queuedMoves.length === MAX_QUEUED_RANKED_MOVES
                      ? "Queue full"
                      : "Queued"}
                    : {queuedMoves.length}
                  </span>
                )}
              </span>
              {board.status === "active" && queuedMoves.length > 0 && (
                <button
                  type="button"
                  className={styles.cancelQueue}
                  onClick={clearQueuedMoves}
                >
                  Cancel queued
                </button>
              )}
            </div>

            {/* Server-controlled Minesweeper board. */}
            <div className="board-area">
              <div
                className="minesweeper-board ranked-server-board"
                onContextMenu={(event) => event.preventDefault()}
                role="grid"
                aria-label="Ranked Minesweeper board"
                style={
                  {
                    "--board-columns": board.columns,
                    "--board-rows": board.rows,
                  } as CSSProperties
                }
              >
                {Array.from({ length: board.rows * board.columns }, (_, index) => {
                  const row = Math.floor(index / board.columns);
                  const column = index % board.columns;
                  const key = `${row}-${column}`;

                  const isRevealed = revealed.has(key);
                  const isFlagged = flags.has(key);
                  if (board.status !== "active" && board.review) {
                    return (
                      <RankedReviewCell
                        key={key}
                        review={board.review}
                        index={index}
                        flagged={isFlagged}
                      />
                    );
                  }
                  const isPending =
                    pendingCell?.row === row && pendingCell?.column === column;
                  const isQueued =
                    board.status === "active" &&
                    queuedMoves.some(
                      (move) =>
                        move.matchId === board.matchId &&
                        move.row === row &&
                        move.column === column,
                    );
                  // Preview flags only: the stored flag list changes after server confirmation.
                  const isVisuallyFlagged =
                    isPending && pendingCell?.action === "flag" ? !isFlagged : isFlagged;
                  const number = revealed.get(key) ?? 0;

                  const classes = [
                    "cell",
                    isRevealed ? "revealed" : "unrevealed",
                    isVisuallyFlagged ? "flagged" : "",
                    isPending ? "ranked-input-pending" : "",
                    isQueued ? styles.queuedCell : "",
                    isRevealed && number > 0 ? numberClasses[number] : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      key={key}
                      type="button"
                      role="gridcell"
                      className={classes}
                      aria-busy={isPending || isQueued}
                      onClick={() => {
                        // Clicking an opened number automatically attempts a chord.
                        if (isRevealed && number > 0) {
                          queueMove("chord", row, column);
                        } else if (!isRevealed && inputMode === "flag") {
                          queueMove("flag", row, column);
                        } else if (!isRevealed && !isFlagged) {
                          queueMove("reveal", row, column);
                        }
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        queueMove("flag", row, column);
                      }}
                      aria-label={
                        isFlagged
                          ? `Row ${row + 1}, column ${column + 1}, flagged`
                          : isRevealed
                            ? `Row ${row + 1}, column ${column + 1}, ${number} adjacent mines`
                            : `Row ${row + 1}, column ${column + 1}, covered`
                      }
                      disabled={board.status !== "active" || (isRevealed && number === 0)}
                    >
                      {isVisuallyFlagged ? (
                        <Flag className="cell-flag" fill="currentColor" />
                      ) : isRevealed && number > 0 ? (
                        number
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {board.status !== "active" ? (
              board.review ? (
                <>
                  <RankedReviewLegend />
                  <p className="ranked-review-note">
                    Completed match · Read-only board. Dashed squares were not revealed
                    during play.
                  </p>
                </>
              ) : (
                <p className="ranked-review-note">
                  Full board inspection is unavailable for this result. Only confirmed
                  visible squares are shown.
                </p>
              )
            ) : (
              <BoardControlsGuide mode="ranked" rows={board.rows} columns={board.columns} mines={board.mineCount} />
            )}

            {/* Display results after a win or loss. */}
            {board.status !== "active" && (
              <FeedbackNotice
                tone={board.status === "won" ? "success" : "warning"}
                title={board.status === "won" ? "Ranked victory" : "Game over"}
                description={
                  board.status === "won"
                    ? "Your verified win has been recorded."
                    : "You hit a mine. Your Ranked match has ended."
                }
                action={
                  <div className="finished-result-actions">
                    <button
                      type="button"
                      className="finished-result-reopen"
                      data-primary="true"
                      onClick={() => setDismissedResultMatchId(null)}
                      disabled={starting}
                    >
                      View results
                    </button>
                    <button
                      type="button"
                      onClick={returnToLobby}
                      disabled={starting}
                    >
                      Return to Ranked lobby
                    </button>
                  </div>
                }
              />
            )}
          </section>
        )}
      </main>
      <RankedResultDialog
        result={rankedResult}
        busy={starting}
        onReturnLobby={returnToLobby}
        onDismiss={() => {
          if (board) setDismissedResultMatchId(board.matchId);
        }}
        onPlayAgain={() => {
          if (starting) return;
          if (board) setDismissedResultMatchId(board.matchId);
          void startMatch();
        }}
      />
    </>
  );
}
