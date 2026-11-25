"use client";

import Link from "next/link";
import { Flag } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { Navbar } from "@/components/play/navbar";
import { RankedResultDialog } from "@/components/ranked/ranked-result-dialog";
import { RankedLadderOverview } from "@/components/ranked/ranked-ladder-overview"; // AI_COACH_RANKED_LADDER_OVERVIEW_V1
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
  const [error, setError] = useState("");
  const [dismissedResultMatchId, setDismissedResultMatchId] = useState<string | null>(
    null,
  );

  // Prevent multiple requests from being sent at the same time.
  const moveInFlight = useRef(false);
  // AI_COACH_RANKED_SINGLE_INITIAL_LOAD_V1: suppress React Strict Mode's duplicate mount effect.
  const initialRecoveryRequested = useRef(false);

  // Restore the player's visible board from Supabase.
  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError("");

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
        setError("Sign in to play Ranked.");
        return false;
      }

      if (!response.ok) {
        throw new Error("Could not load your Ranked match.");
      }

      const data: RankedBoard = await response.json();
      rememberMatchId(data.status === "active" ? data.matchId : null);

      setBoard(data);
      setNoMatch(false);
      return true;
    } catch {
      setBoard(null);
      setNoMatch(false);
      setError("Could not connect to Ranked. Please try again.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Load the saved game when the page opens.
  useEffect(() => {
    if (initialRecoveryRequested.current) return;
    initialRecoveryRequested.current = true;
    void loadBoard();
  }, [loadBoard]);

  // Create a new match or resume an active one.
  async function startMatch() {
    setStarting(true);
    setError("");

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
      await loadBoard();
    } catch {
      setError("Could not start Ranked. Please try again.");
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
    setPendingCell({ row, column, action: "reveal" });
    setSubmittingMove(true);
    setError("");

    try {
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
          firstMoveDone: true,
        };
      });
    } catch (error) {
      // A failed response does not prove the transaction failed. Never replay it.
      const recovered = await loadBoard();
      if (recovered) {
        setError(
          (error instanceof Error
            ? error.message
            : "Could not process your Ranked move.") +
            " Board refreshed. If the match ended, check Ranked history.",
        );
      }
    } finally {
      setPendingCell(null);
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
      setError("Reveal a square before placing flags.");
      return;
    }

    // Revealed squares cannot be flagged.
    if (board.revealedCells.some((cell) => cell.row === row && cell.column === column)) {
      return;
    }

    moveInFlight.current = true;
    setPendingCell({ row, column, action: "flag" });
    setSubmittingMove(true);
    setError("");

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
    } catch (error) {
      // A failed response does not prove the transaction failed. Never replay it.
      const recovered = await loadBoard();
      if (recovered) {
        setError(
          (error instanceof Error
            ? error.message
            : "Could not process your Ranked flag.") +
            " Board refreshed. If the match ended, check Ranked history.",
        );
      }
    } finally {
      setPendingCell(null);
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
    setPendingCell({ row, column, action: "chord" });
    setSubmittingMove(true);
    setError("");

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
        };
      });
    } catch (error) {
      // A failed response does not prove the transaction failed. Never replay it.
      const recovered = await loadBoard();
      if (recovered) {
        setError(
          (error instanceof Error
            ? error.message
            : "Could not process your Ranked chord.") +
            " Board refreshed. If the match ended, check Ranked history.",
        );
      }
    } finally {
      setPendingCell(null);
      moveInFlight.current = false;
      setSubmittingMove(false);
    }
  }

  const rankedResult = buildRankedResult(board, dismissedResultMatchId);

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

      <main className="page-shell" id="main-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">COMPETE. IMPROVE. CLIMB.</p>
            <h1>
              Ranked<span className="title-period">.</span>
            </h1>
            <p className="page-subtitle">Intermediate · 16 × 16 · 40 mines</p>
          </div>
        </div>

        <p>
          <Link href="/">← Back to Practice</Link>
        </p>

        <RankedLadderOverview />

        {loading && <p role="status">Loading your Ranked match...</p>}

        {error && (
          <div>
            <p role="alert">{error}</p>
            <button
              type="button"
              className="mode-button"
              disabled={loading || starting || submittingMove}
              onClick={() => void loadBoard()}
            >
              Refresh Ranked board
            </button>
          </div>
        )}

        {noMatch && !loading && (
          <section className="game-panel">
            <h2>No active Ranked match</h2>
            <p>Start a new match to begin playing.</p>

            <button
              type="button"
              className="mode-button selected"
              onClick={startMatch}
              disabled={starting}
            >
              {starting ? "Starting..." : "Start Ranked"}
            </button>
          </section>
        )}

        {board && !loading && (
          <section className="game-panel">
            {/* Display the current game information. */}
            <div
              className="game-controls"
              style={{
                display: "flex",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <span>Status: {board.status}</span>
              <span>Moves: {board.moveCount}</span>
              <span>
                Flags: {board.flagCount} / {board.mineCount}
              </span>
            </div>

            {/* Choose what a left-click does. Right-click always toggles a flag. */}
            <div className="game-controls" role="group" aria-label="Ranked cell action">
              <button
                type="button"
                className={inputMode === "reveal" ? "mode-button active" : "mode-button"}
                aria-pressed={inputMode === "reveal"}
                onClick={() => setInputMode("reveal")}
                disabled={board.status !== "active"}
              >
                Reveal
              </button>

              <button
                type="button"
                className={inputMode === "flag" ? "mode-button active" : "mode-button"}
                aria-pressed={inputMode === "flag"}
                onClick={() => setInputMode("flag")}
                disabled={board.status !== "active" || !board.firstMoveDone}
              >
                <Flag size={15} aria-hidden="true" /> Flag
              </button>
            </div>

            {/* Reserve space so the board does not jump while a move is processed. */}
            <p role="status" style={{ minHeight: "1.5rem" }}>
              {submittingMove ? "Processing move..." : " "}
            </p>

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
                  const isPending =
                    pendingCell?.row === row && pendingCell?.column === column;
                  // Preview flags only: the stored flag list changes after server confirmation.
                  const isVisuallyFlagged =
                    isPending && pendingCell?.action === "flag" ? !isFlagged : isFlagged;
                  const number = revealed.get(key) ?? 0;

                  const classes = [
                    "cell",
                    isRevealed ? "revealed" : "unrevealed",
                    isVisuallyFlagged ? "flagged" : "",
                    isPending ? "ranked-input-pending" : "",
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
                      aria-busy={isPending}
                      onClick={() => {
                        // Clicking an opened number automatically attempts a chord.
                        if (isRevealed && number > 0) {
                          void chordCell(row, column);
                        } else if (!isRevealed && inputMode === "flag") {
                          void toggleFlag(row, column);
                        } else if (!isRevealed && !isFlagged) {
                          void revealCell(row, column);
                        }
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        void toggleFlag(row, column);
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

            <p className="board-instructions">
              Reveal: click a covered square · Flag: use Flag mode or right-click · Chord:
              click a revealed number when its neighboring flags match.
            </p>

            {/* Display results after a win or loss. */}
            {board.status !== "active" && (
              <div className="game-controls">
                <p role="status">
                  {board.status === "won"
                    ? "You won your Ranked match!"
                    : "Game over! You hit a mine."}
                </p>

                <button
                  type="button"
                  className="mode-button selected"
                  onClick={startMatch}
                  disabled={starting}
                >
                  {starting ? "Starting..." : "New Ranked Match"}
                </button>
              </div>
            )}
          </section>
        )}
      </main>
      <RankedResultDialog
        result={rankedResult}
        busy={starting}
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
