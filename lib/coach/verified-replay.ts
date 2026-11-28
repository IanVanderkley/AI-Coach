import type { GameplayMove } from "./types";
import { visibleReplayHash } from "./visible-board-hash.ts";

// Deterministic, read-only analysis of a Minesweeper recording.
// Critical rule: only visible numbers, board dimensions, and total mine count
// may be used to PROVE a move. The true mine layout is used only to replay
// what happened after the player acted, never to judge their earlier knowledge.

export type VisibleCell = {
  revealed: boolean;
  flagged: boolean;
  adjacentMines: number | null;
  exploded: boolean;
};

export type TeachingGroup = {
  clue: number | null;
  originalCount: number;
  remainingMines: number;
  cells: number[];
  knownMines: number[];
  knownSafe: number[];
};
export type ProofVisual = {
  groups: TeachingGroup[];
  result: number[];
  mineCount: number;
};
/** Experimental certificate for partial overlaps; not a subset diagram. */
export type OverlapProof = {
  groups: TeachingGroup[];
  region: "shared" | "only-a" | "only-b";
  sharedMin: number;
  sharedMax: number;
  result: number[];
  mineCount: number;
};

export type ProofDerivation = {
  title: string;
  text: string;
  dependencies: number[];
  clues: number[];
  visual?: ProofVisual;
  overlap?: OverlapProof;
};

export type Proof = {
  index: number;
  reason: string;
  supportingCells: number[];
  derivation?: ProofDerivation;
};

export type Deductions = {
  safe: Proof[];
  mines: Proof[];
};

export type Decision = "good" | "mistake" | "not-enough-evidence";
export type MistakeType =
  | "unnecessary-guess"
  | "revealed-known-mine"
  | "flagged-known-safe"
  | null;

export type ReplayFrame = {
  actionNumber: number;
  move: GameplayMove;
  before: VisibleCell[];
  after: VisibleCell[];
  deductions: Deductions;
  decision: Decision;
  mistakeType: MistakeType;
  explanation: string;
  changed: boolean;
  status: "playing" | "won" | "lost";
};

export type RecordedGame = {
  rows: number;
  columns: number;
  mineCount: number;
  mines: number[];
  moves: GameplayMove[];
};

export type ReplayResult = {
  rows: number;
  columns: number;
  frames: ReplayFrame[];
  status: "playing" | "won" | "lost";
  finalBoard: VisibleCell[];
};

type Constraint = {
  cells: number[];
  count: number;
  source: number[];
  teaching?: { description: string; dependencies: number[]; group: TeachingGroup };
};

function around(index: number, rows: number, columns: number): number[] {
  const row = Math.floor(index / columns);
  const col = index % columns;
  const result: number[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < rows && c >= 0 && c < columns) {
        result.push(r * columns + c);
      }
    }
  }
  return result;
}

function label(index: number, columns: number): string {
  return `row ${Math.floor(index / columns) + 1}, column ${(index % columns) + 1}`;
}

function snapshot(cells: VisibleCell[]): VisibleCell[] {
  return cells.map((cell) => ({ ...cell }));
}

/**
 * Derive *only* guaranteed cells using the numbers the player can see.
 * Flags are NOT accepted as proof of mines; they remain covered unknowns until
 * the visible board independently proves them. Subset and total-mine rules are
 * applied until no new logical deductions can be made.
 *
 * Not finding a proof does NOT establish that the move was unavoidable.
 */
export function deduceVisibleBoard(
  rows: number,
  columns: number,
  mineCount: number,
  cells: readonly VisibleCell[],
  explain = false,
  advancedOverlap = false,
): Deductions {
  const total = rows * columns;
  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(columns) ||
    rows < 2 ||
    columns < 2 ||
    !Number.isInteger(mineCount) ||
    mineCount < 0 ||
    mineCount >= total ||
    cells.length !== total
  ) {
    throw new Error("Invalid visible board dimensions or mine count.");
  }

  // Advanced inspection is experimental, not enabled by existing replay callers.
  if (
    advancedOverlap &&
    cells.some((cell) => cell.exploded || (cell.revealed && cell.adjacentMines === null))
  ) {
    return { safe: [], mines: [] };
  }
  let overlapBudget = 100_000;
  const safe = new Map<number, Proof>();
  const mines = new Map<number, Proof>();

  function add(
    target: Map<number, Proof>,
    index: number,
    reason: string,
    source: number[],
    derivation?: ProofDerivation,
  ): boolean {
    if (safe.has(index) || mines.has(index) || cells[index].revealed) return false;
    target.set(index, {
      index,
      reason,
      supportingCells: [...source],
      ...(derivation ? { derivation } : {}),
    });
    return true;
  }

  function coordinates(indices: readonly number[]) {
    if (indices.length === 0) return "none";
    const shown = indices
      .slice(0, 12)
      .map((index) => `R${Math.floor(index / columns) + 1}C${(index % columns) + 1}`);
    return (
      shown.join(", ") + (indices.length > 12 ? ` and ${indices.length - 12} more` : "")
    );
  }
  function constraintText(c: Constraint) {
    return c.teaching?.description ?? "";
  }
  function conclusion(count: number, indices: number[]) {
    return count === 0
      ? `There are 0 mines among these ${indices.length} remaining squares, so all are safe: ${coordinates(indices)}.`
      : `There are ${count} mines in exactly ${indices.length} remaining squares, so every one is a mine: ${coordinates(indices)}.`;
  }
  for (let pass = 0; pass < total * 2 + 2; pass += 1) {
    let changed = false;
    const constraints: Constraint[] = [];

    // A revealed number constrains the actual mines in its still-covered neighbours.
    // A player's flag is treated as an unverified mark, not a known mine.
    for (let index = 0; index < total; index += 1) {
      const cell = cells[index];
      if (!cell.revealed || cell.adjacentMines === null || cell.exploded) continue;
      const neighbours = around(index, rows, columns);
      const confirmedMines = neighbours.filter((near) => mines.has(near)).length;
      const unknown = neighbours.filter(
        (near) => !cells[near].revealed && !safe.has(near) && !mines.has(near),
      );
      const remaining = cell.adjacentMines - confirmedMines;
      if (remaining < 0 || remaining > unknown.length) {
        // An impossible state must not generate further proofs.
        return { safe: [], mines: [] };
      }
      if (unknown.length > 0) {
        const constraint: Constraint = {
          cells: unknown,
          count: remaining,
          source: [index],
        };
        if (explain) {
          const knownMines = neighbours.filter((near) => mines.has(near));
          const knownSafe = neighbours.filter((near) => safe.has(near));
          constraint.teaching = {
            dependencies: [...knownMines, ...knownSafe],
            group: {
              clue: index,
              originalCount: cell.adjacentMines,
              remainingMines: remaining,
              cells: unknown,
              knownMines,
              knownSafe,
            },
            description: `Clue ${coordinates([index])} shows ${cell.adjacentMines}: exactly that many touching squares contain mines. Earlier deductions account for ${knownMines.length} mines (${coordinates(knownMines)}) and ${knownSafe.length} covered safe squares (${coordinates(knownSafe)}). Subtract the known mines: ${cell.adjacentMines} - ${knownMines.length} = ${remaining} mines among ${unknown.length} unresolved neighbors (${coordinates(unknown)}).`,
          };
        }
        constraints.push(constraint);
      }
    }

    // The global mine count is public knowledge. It does not validate flags.
    const unknownGlobally: number[] = [];
    for (let index = 0; index < total; index += 1) {
      if (!cells[index].revealed && !safe.has(index) && !mines.has(index)) {
        unknownGlobally.push(index);
      }
    }
    const minesRemaining = mineCount - mines.size;
    if (minesRemaining < 0 || minesRemaining > unknownGlobally.length) {
      return { safe: [], mines: [] };
    }
    if (unknownGlobally.length > 0) {
      const constraint: Constraint = {
        cells: unknownGlobally,
        count: minesRemaining,
        source: [],
      };
      if (explain) {
        constraint.teaching = {
          dependencies: [...mines.keys(), ...safe.keys()],
          group: {
            clue: null,
            originalCount: mineCount,
            remainingMines: minesRemaining,
            cells: unknownGlobally,
            knownMines: [...mines.keys()],
            knownSafe: [...safe.keys()],
          },
          description: `The board contains ${mineCount} mines in total. Earlier deductions proved ${mines.size} mines and ${safe.size} covered safe squares. Revealed squares are already safe. That leaves ${mineCount} - ${mines.size} = ${minesRemaining} mines among ${unknownGlobally.length} unresolved covered squares (${coordinates(unknownGlobally)}).`,
        };
      }
      constraints.push(constraint);
    }

    // If a constraint has no remaining mines, all of its unknown cells are safe.
    // If every remaining cell is a mine, all of those cells are confirmed mines.
    for (const constraint of constraints) {
      if (constraint.count !== 0 && constraint.count !== constraint.cells.length)
        continue;
      const target = constraint.count === 0 ? safe : mines;
      const kind = constraint.count === 0 ? "safe" : "a mine";
      const reason =
        constraint.source.length === 0
          ? `Total mine count proves this cell is ${kind}.`
          : `Visible number at ${label(constraint.source[0], columns)} proves this cell is ${kind}.`;
      const derivation: ProofDerivation | undefined = explain
        ? {
            title:
              constraint.source.length === 0
                ? "Total mine count"
                : constraint.count === 0
                  ? "Remaining squares are safe"
                  : "All remaining squares are mines",
            text: `${constraintText(constraint)} ${conclusion(constraint.count, constraint.cells)}`,
            dependencies: constraint.teaching?.dependencies ?? [],
            clues: constraint.source,
            visual: constraint.teaching
              ? {
                  groups: [constraint.teaching.group],
                  result: constraint.cells,
                  mineCount: constraint.count,
                }
              : undefined,
          }
        : undefined;
      for (const index of constraint.cells) {
        changed = add(target, index, reason, constraint.source, derivation) || changed;
      }
    }
    if (changed) continue; // Simplify constraints with fresh proofs first.

    // Subset deduction: if A's unknowns are a subset of B's, subtract their
    // mine totals to prove the cells in B minus A.
    for (const a of constraints) {
      const setA = new Set(a.cells);
      for (const b of constraints) {
        if (a === b || a.cells.length >= b.cells.length) continue;
        if (!a.cells.every((index) => b.cells.includes(index))) continue;
        const difference = b.cells.filter((index) => !setA.has(index));
        const remaining = b.count - a.count;
        if (remaining !== 0 && remaining !== difference.length) continue;
        const target = remaining === 0 ? safe : mines;
        const kind = remaining === 0 ? "safe" : "a mine";
        const evidence = [...new Set([...a.source, ...b.source])];
        const reason = `Comparing visible number constraints proves this cell is ${kind}.`;
        const derivation: ProofDerivation | undefined = explain
          ? {
              title: "Overlapping clues — subset subtraction",
              text: `Group A: ${constraintText(a)} Group B: ${constraintText(b)} Every unresolved square in A also belongs to B. Subtract A from B: ${b.count} - ${a.count} = ${remaining} mines in the ${difference.length} extra squares (${coordinates(difference)}). ${conclusion(remaining, difference)}`,
              dependencies: [
                ...new Set([
                  ...(a.teaching?.dependencies ?? []),
                  ...(b.teaching?.dependencies ?? []),
                ]),
              ],
              clues: evidence,
              visual:
                a.teaching && b.teaching
                  ? {
                      groups: [a.teaching.group, b.teaching.group],
                      result: difference,
                      mineCount: remaining,
                    }
                  : undefined,
            }
          : undefined;
        for (const index of difference) {
          changed = add(target, index, reason, evidence, derivation) || changed;
        }
      }
    }

    // Only attempt the experimental rule once the existing rules are exhausted.
    // All constraints refer to the same pass's unresolved cells. No flags or
    // hidden mine locations are used. An exhausted budget proves nothing new.
    if (!changed && advancedOverlap && overlapBudget > 0) {
      const key = (indices: readonly number[]) =>
        [...indices].sort((a, b) => a - b).join(",");
      const byCells = new Map<string, Constraint>();
      for (const constraint of constraints) {
        const k = key(constraint.cells);
        const previous = byCells.get(k);
        if (previous && previous.count !== constraint.count)
          return { safe: [], mines: [] };
        if (!previous) byCells.set(k, constraint);
      }
      const unique = [...byCells.values()];
      pairs: for (let i = 0; i < unique.length; i++) {
        const a = unique[i];
        const setA = new Set(a.cells);
        for (let j = i + 1; j < unique.length; j++) {
          if (overlapBudget-- <= 0) break pairs;
          const b = unique[j];
          const setB = new Set(b.cells);
          const shared = b.cells.filter((n) => setA.has(n));
          const onlyA = a.cells.filter((n) => !setB.has(n));
          const onlyB = b.cells.filter((n) => !setA.has(n));
          if (!shared.length || !onlyA.length || !onlyB.length) continue;
          let lo = Math.max(0, a.count - onlyA.length, b.count - onlyB.length);
          let hi = Math.min(shared.length, a.count, b.count);
          // If a third visible constraint covers exactly the union, inclusion-
          // exclusion determines the shared mine count (e.g. two-sided 1-2-1).
          const union = byCells.get(key([...a.cells, ...onlyB]));
          if (union) {
            const exact = a.count + b.count - union.count;
            lo = Math.max(lo, exact);
            hi = Math.min(hi, exact);
          }
          if (lo > hi) return { safe: [], mines: [] };
          const inputs = union ? [a, b, union] : [a, b];
          const evidence = [...new Set(inputs.flatMap((c) => c.source))];
          const regions = [
            { region: "shared" as const, cells: shared, min: lo, max: hi },
            {
              region: "only-a" as const,
              cells: onlyA,
              min: a.count - hi,
              max: a.count - lo,
            },
            {
              region: "only-b" as const,
              cells: onlyB,
              min: b.count - hi,
              max: b.count - lo,
            },
          ];
          for (const region of regions) {
            const count = region.min === region.max ? region.min : -1;
            if (count !== 0 && count !== region.cells.length) continue;
            const target = count === 0 ? safe : mines;
            const reason = `Partial overlap of visible constraints proves this cell is ${count === 0 ? "safe" : "a mine"}.`;
            const derivation: ProofDerivation | undefined = explain
              ? {
                  title: "Overlapping clues — shared mine bounds",
                  text: `${inputs.map((c, k) => `Group ${"ABC"[k]}: ${constraintText(c)}`).join(" ")} The two groups share ${shared.length} squares (${coordinates(shared)}). Their shared mine count is between ${lo} and ${hi}.${union ? ` The union contains ${union.count} mines, so ${a.count} + ${b.count} - ${union.count} gives the shared mine count.` : ""} The ${region.region} region has between ${region.min} and ${region.max} mines. ${conclusion(count, region.cells)}`,
                  dependencies: [
                    ...new Set(inputs.flatMap((c) => c.teaching?.dependencies ?? [])),
                  ],
                  clues: evidence,
                  overlap: {
                    groups: inputs.map((c) => c.teaching!.group),
                    region: region.region,
                    sharedMin: lo,
                    sharedMax: hi,
                    result: region.cells,
                    mineCount: count,
                  },
                }
              : undefined;
            for (const index of region.cells) {
              if ((count === 0 ? mines : safe).has(index)) return { safe: [], mines: [] };
              changed = add(target, index, reason, evidence, derivation) || changed;
            }
          }
        }
      }
    }

    if (!changed) break;
  }

  return { safe: [...safe.values()], mines: [...mines.values()] };
}

/** Recreate the exact visible board after every recorded player action. */
export function replayRecordedGame(game: RecordedGame): ReplayResult {
  const { rows, columns, mineCount, moves } = game;
  const total = rows * columns;
  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(columns) ||
    rows < 2 ||
    columns < 2 ||
    rows > 50 ||
    columns > 50 ||
    !Number.isInteger(mineCount) ||
    mineCount < 0 ||
    mineCount >= total ||
    !Array.isArray(game.mines) ||
    game.mines.length !== mineCount ||
    !game.mines.every(
      (index) => Number.isInteger(index) && index >= 0 && index < total,
    ) ||
    new Set(game.mines).size !== mineCount ||
    !Array.isArray(moves) ||
    moves.length > 10000
  ) {
    throw new Error("Invalid recorded Minesweeper game.");
  }

  const hiddenMines = new Set(game.mines);
  const adjacentCounts = Array.from(
    { length: total },
    (_, index) =>
      around(index, rows, columns).filter((near) => hiddenMines.has(near)).length,
  );
  const cells: VisibleCell[] = Array.from({ length: total }, () => ({
    revealed: false,
    flagged: false,
    adjacentMines: null,
    exploded: false,
  }));
  const frames: ReplayFrame[] = [];
  let status: ReplayResult["status"] = "playing";

  function reveal(index: number): boolean {
    if (cells[index].revealed || cells[index].flagged) return false;
    if (hiddenMines.has(index)) {
      // The live Practice board shows every mine on loss, but not before.
      for (const mine of hiddenMines) {
        cells[mine].revealed = true;
        cells[mine].adjacentMines = null;
      }
      cells[index].exploded = true;
      status = "lost";
      return true;
    }
    const pending = [index];
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (cells[current].revealed || cells[current].flagged) continue;
      cells[current].revealed = true;
      cells[current].adjacentMines = adjacentCounts[current];
      if (adjacentCounts[current] === 0) {
        for (const neighbour of around(current, rows, columns)) {
          if (!cells[neighbour].revealed && !cells[neighbour].flagged) {
            pending.push(neighbour);
          }
        }
      }
    }
    return true;
  }

  let previousTime = -1;
  for (let n = 0; n < moves.length; n += 1) {
    if (status !== "playing") {
      throw new Error(
        `Recording contains an action after the game ended (move ${n + 1}).`,
      );
    }
    const move = moves[n];
    if (
      !move ||
      !Number.isInteger(move.row) ||
      !Number.isInteger(move.col) ||
      move.row < 0 ||
      move.row >= rows ||
      move.col < 0 ||
      move.col >= columns ||
      !["reveal", "flag", "unflag", "chord"].includes(move.action)
    ) {
      throw new Error(`Invalid action at move ${n + 1}.`);
    }

    if (move.atMs !== undefined) {
      if (!Number.isSafeInteger(move.atMs) || move.atMs < previousTime) {
        throw new Error(`Invalid or out-of-order timestamp at move ${n + 1}.`);
      }
      previousTime = move.atMs;
    }
    const index = move.row * columns + move.col;
    const before = snapshot(cells);
    const deductions = deduceVisibleBoard(rows, columns, mineCount, before);
    const safe = new Map(deductions.safe.map((proof) => [proof.index, proof]));
    const mines = new Map(deductions.mines.map((proof) => [proof.index, proof]));
    let decision: Decision = "not-enough-evidence";
    let mistakeType: MistakeType = null;
    let explanation = "No conclusion can be proven from the visible information alone.";
    let changed = false;
    const target = cells[index];

    if (move.action === "flag" && !target.revealed && !target.flagged) {
      const count = cells.filter((cell) => cell.flagged).length;
      if (count < mineCount) {
        if (safe.has(index)) {
          decision = "mistake";
          mistakeType = "flagged-known-safe";
          explanation = `The visible numbers already proved ${label(index, columns)} was safe.`;
        } else if (mines.has(index)) {
          decision = "good";
          explanation = `The visible numbers proved ${label(index, columns)} contained a mine.`;
        } else {
          explanation =
            "This flag was not supported or contradicted by a visible-board proof. Its actual correctness does not establish the quality of the decision.";
        }
        target.flagged = true;
        changed = true;
      }
    } else if (move.action === "unflag" && target.flagged && !target.revealed) {
      explanation =
        "A flag was removed. This action alone is not classified as a mistake or a proven strength.";
      target.flagged = false;
      changed = true;
    } else if (move.action === "reveal" && !target.revealed && !target.flagged) {
      if (mines.has(index)) {
        decision = "mistake";
        mistakeType = "revealed-known-mine";
        explanation = `The visible numbers already proved ${label(index, columns)} contained a mine.`;
      } else if (safe.has(index)) {
        decision = "good";
        explanation = `The visible numbers already proved ${label(index, columns)} was safe.`;
      } else if (
        safe.size > 0 &&
        frames.some((frame) => frame.move.action === "reveal")
      ) {
        decision = "mistake";
        mistakeType = "unnecessary-guess";
        explanation = `This square was uncertain while ${safe.size} other square(s) were provably safe.`;
      }
      if (decision === "not-enough-evidence") {
        explanation = frames.some(
          (frame) => frame.move.action === "reveal" && frame.changed,
        )
          ? "This reveal was unresolved by the solver; no proven-safe alternative was found. That does not prove guessing was unavoidable."
          : "The opening reveal is not graded as a guess merely because there are no visible clues yet.";
      }
      changed = reveal(index);
    } else if (
      move.action === "chord" &&
      target.revealed &&
      target.adjacentMines !== null &&
      target.adjacentMines > 0
    ) {
      const neighbours = around(index, rows, columns);
      const flags = neighbours.filter((near) => cells[near].flagged).length;
      const targets = neighbours.filter(
        (near) => !cells[near].revealed && !cells[near].flagged,
      );
      if (flags === target.adjacentMines && targets.length > 0) {
        if (targets.some((near) => mines.has(near))) {
          decision = "mistake";
          mistakeType = "revealed-known-mine";
          explanation =
            "This chord included a square the visible numbers had proven was a mine.";
        } else if (targets.every((near) => safe.has(near))) {
          decision = "good";
          explanation = "Every square opened by this chord was provably safe.";
        } else if (safe.size > 0) {
          decision = "mistake";
          mistakeType = "unnecessary-guess";
          explanation =
            "This chord included uncertain squares while proven-safe moves were available.";
        } else {
          explanation =
            "The solver could not establish the safety of every square in this chord. No proven-safe alternative was found; the risk remains unresolved.";
        }
        if (targets.some((neighbour) => hiddenMines.has(neighbour))) {
          // Match the LIVE Practice board exactly: a failed chord reveals
          // every mine immediately, but does not open any safe neighbour.
          // The old replay revealed safe cells before reaching the mine.
          const firstMine = targets.find((neighbour) => hiddenMines.has(neighbour))!;
          for (const mine of hiddenMines) {
            cells[mine].revealed = true;
            cells[mine].adjacentMines = null;
          }
          cells[firstMine].exploded = true;
          status = "lost";
          changed = true;
        } else {
          for (const neighbour of targets) {
            changed = reveal(neighbour) || changed;
          }
        }
      }
    }

    if (!cells.some((cell) => cell.exploded)) {
      const revealedSafe = cells.filter(
        (cell, i) => cell.revealed && !hiddenMines.has(i),
      ).length;
      if (revealedSafe === total - mineCount) status = "won";
    }

    // A stamped live recording must have changed the board. Legacy recordings
    // without checksums remain supported for the temporary five-game history.
    if (move.afterHash !== undefined) {
      if (!/^[0-9a-f]{8}$/.test(move.afterHash) || !changed) {
        throw new Error(`Invalid checkpoint on move ${n + 1}.`);
      }
      const observed = visibleReplayHash(cells, rows, columns);
      if (observed !== move.afterHash) {
        throw new Error(
          `Visible board mismatch after move ${n + 1}. The recording cannot be safely coached.`,
        );
      }
    }

    frames.push({
      actionNumber: n + 1,
      move: { ...move },
      before,
      after: snapshot(cells),
      deductions,
      decision,
      mistakeType,
      explanation,
      changed,
      status,
    });
  }

  return { rows, columns, frames, status, finalBoard: snapshot(cells) };
}
