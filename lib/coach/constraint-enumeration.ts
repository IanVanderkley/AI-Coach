import type { VisibleCell } from "./verified-replay.ts";

// Experimental, read-only. No existing replay or grading caller uses this module.
// Counts are frontier assignments, NOT equally weighted full-board layouts.
export type EnumerationResult =
  | { status: "complete"; safe: number[]; mines: number[]; frontierModels: number; nodes: number; frontierSize: number; outsideSize: number }
  | { status: "limited" | "invalid" | "inconsistent" | "terminal"; safe: []; mines: []; nodes: number };

const MAX_FRONTIER = 18;
const MAX_NODES = 100_000;

/** Exhaust the clue-adjacent frontier; handle all other covered squares by
 * their possible remaining mine count. Never trust player flags or a partial search.
 * The optional limits may lower, but never raise, the hard work limits. */
export function enumerateVisibleBoard(
  rows: number, columns: number, mineCount: number, board: readonly VisibleCell[],
  limits: { maxFrontier?: number; maxNodes?: number } = {},
): EnumerationResult {
  let nodes = 0;
  const empty = (status: "limited" | "invalid" | "inconsistent" | "terminal"): EnumerationResult => ({ status, safe: [], mines: [], nodes });
  const total = rows * columns;
  const maxFrontier = limits.maxFrontier ?? MAX_FRONTIER;
  const maxNodes = limits.maxNodes ?? MAX_NODES;
  if (!Number.isSafeInteger(rows) || !Number.isSafeInteger(columns) || rows < 2 || columns < 2 || rows > 50 || columns > 50 ||
      !Number.isSafeInteger(mineCount) || mineCount < 0 || mineCount >= total || !Array.isArray(board) || board.length !== total ||
      !Number.isSafeInteger(maxFrontier) || maxFrontier < 0 || maxFrontier > MAX_FRONTIER || !Number.isSafeInteger(maxNodes) || maxNodes < 1 || maxNodes > MAX_NODES) return empty("invalid");
  for (let i = 0; i < total; i++) {
    const cell = board[i];
    if (!cell || typeof cell.revealed !== "boolean" || typeof cell.exploded !== "boolean") return empty("invalid");
    if (cell.exploded || (cell.revealed && cell.adjacentMines === null)) return empty("terminal");
    if (cell.revealed && (!Number.isInteger(cell.adjacentMines) || cell.adjacentMines! < 0 || cell.adjacentMines! > 8)) return empty("invalid");
  }
  const covered: number[] = [];
  const frontierSet = new Set<number>();
  const constraints: { cells: number[]; count: number }[] = [];
  for (let i = 0; i < total; i++) {
    if (!board[i].revealed) { covered.push(i); continue; }
    const r = Math.floor(i / columns), c = i % columns;
    const cells: number[] = [];
    for (let y = Math.max(0, r - 1); y <= Math.min(rows - 1, r + 1); y++)
      for (let x = Math.max(0, c - 1); x <= Math.min(columns - 1, c + 1); x++) {
        const j = y * columns + x;
        if (!board[j].revealed) { cells.push(j); frontierSet.add(j); }
      }
    const count = board[i].adjacentMines!;
    if (count > cells.length) return empty("inconsistent");
    if (cells.length) constraints.push({ cells, count });
  }
  if (mineCount > covered.length) return empty("inconsistent");
  if (frontierSet.size > maxFrontier) return empty("limited");
  const outside = covered.filter(i => !frontierSet.has(i));
  // Highest degree first, then index, for deterministic pruning.
  const membership = new Map<number, number[]>();
  constraints.forEach((g, j) => g.cells.forEach(i => {
    const list = membership.get(i) ?? []; list.push(j); membership.set(i, list);
  }));
  const frontier = [...frontierSet].sort((a,b) => membership.get(b)!.length - membership.get(a)!.length || a-b);
  const left = constraints.map(g => g.cells.length);
  const needed = constraints.map(g => g.count);
  const hits = frontier.map(() => 0);
  const assignment = frontier.map(() => 0);
  let models = 0, outsideMin = Infinity, outsideMax = -Infinity, limited = false;
  function visit(depth: number, used: number) {
    if (limited) return;
    if (nodes >= maxNodes) { limited = true; return; }
    nodes++;
    if (used > mineCount || used + frontier.length - depth + outside.length < mineCount) return;
    if (depth === frontier.length) {
      if (needed.some(n => n !== 0)) return;
      const remaining = mineCount - used;
      if (remaining < 0 || remaining > outside.length) return;
      models++;
      for (let i = 0; i < frontier.length; i++) hits[i] += assignment[i];
      outsideMin = Math.min(outsideMin, remaining); outsideMax = Math.max(outsideMax, remaining);
      return;
    }
    const groups = membership.get(frontier[depth])!;
    for (const value of [0, 1]) {
      assignment[depth] = value;
      let valid = true;
      for (const j of groups) { left[j]--; needed[j] -= value; if (needed[j] < 0 || needed[j] > left[j]) valid = false; }
      if (valid) visit(depth + 1, used + value);
      for (const j of groups) { left[j]++; needed[j] += value; }
      if (limited) return;
    }
  }
  visit(0, 0);
  if (limited) return empty("limited");
  if (!models) return empty("inconsistent");
  const safe = frontier.filter((_, i) => hits[i] === 0);
  const mines = frontier.filter((_, i) => hits[i] === models);
  if (outsideMax === 0) safe.push(...outside);
  else if (outsideMin === outside.length) mines.push(...outside);
  return { status: "complete", safe: safe.sort((a,b) => a-b), mines: mines.sort((a,b) => a-b), frontierModels: models, nodes, frontierSize: frontier.length, outsideSize: outside.length };
}
