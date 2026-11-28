import { deduceVisibleBoard, type VisibleCell } from "./verified-replay.ts";
import type { ProbabilityResult } from "./constraint-enumeration.ts";

type Limits = { maxComponent?: number; maxNodes?: number; maxCombineWork?: number };
type Group = { cells: number[]; count: number };
type Distribution = Map<number, bigint>;
type Component = { cells: number[]; counts: Distribution; hits: Distribution[] };
const ZERO = BigInt(0),
  ONE = BigInt(1);
const MAX_COMPONENT = 18,
  MAX_NODES = 100_000,
  MAX_COMBINE = 250_000;

/** Independent clue components share only the public mine total. Count every
 * compatible full-board layout exactly, or return no partial probabilities. */
export function calculateComponentProbabilities(
  rows: number,
  columns: number,
  mineCount: number,
  board: readonly VisibleCell[],
  limits: Limits = {},
): ProbabilityResult {
  return countComponents(rows, columns, mineCount, board, limits, false);
}

/** Retry difficult boards after substituting only logically proven cell values.
 * The original constraints remain enforced; known squares contribute their
 * exact fixed values to every compatible layout. */
export function calculateReducedComponentProbabilities(
  rows: number,
  columns: number,
  mineCount: number,
  board: readonly VisibleCell[],
): ProbabilityResult {
  return countComponents(rows, columns, mineCount, board, {}, true);
}

function countComponents(
  rows: number,
  columns: number,
  mineCount: number,
  board: readonly VisibleCell[],
  limits: Limits,
  reduce: boolean,
): ProbabilityResult {
  let nodes = 0,
    work = 0,
    limited = false;
  const fail = (
    status: "limited" | "invalid" | "inconsistent" | "terminal",
  ): ProbabilityResult => ({ status, squares: [], nodes });
  const cap = limits.maxComponent ?? (reduce ? 128 : MAX_COMPONENT),
    nodeCap = limits.maxNodes ?? MAX_NODES,
    workCap = limits.maxCombineWork ?? MAX_COMBINE;
  const total = rows * columns;
  if (
    !Number.isSafeInteger(rows) ||
    !Number.isSafeInteger(columns) ||
    rows < 2 ||
    columns < 2 ||
    rows > 50 ||
    columns > 50 ||
    !Number.isSafeInteger(mineCount) ||
    mineCount < 0 ||
    mineCount >= total ||
    !Array.isArray(board) ||
    board.length !== total ||
    !Number.isSafeInteger(cap) ||
    cap < 0 ||
    cap > (reduce ? 128 : MAX_COMPONENT) ||
    !Number.isSafeInteger(nodeCap) ||
    nodeCap < 1 ||
    nodeCap > MAX_NODES ||
    !Number.isSafeInteger(workCap) ||
    workCap < 1 ||
    workCap > MAX_COMBINE
  )
    return fail("invalid");
  for (const cell of board) {
    if (!cell || typeof cell.revealed !== "boolean" || typeof cell.exploded !== "boolean")
      return fail("invalid");
    if (cell.exploded || (cell.revealed && cell.adjacentMines === null))
      return fail("terminal");
    if (
      cell.revealed &&
      (!Number.isInteger(cell.adjacentMines) ||
        cell.adjacentMines! < 0 ||
        cell.adjacentMines! > 8)
    )
      return fail("invalid");
  }
  const fixed = new Map<number, 0 | 1>();
  if (reduce) {
    const proofs = deduceVisibleBoard(rows, columns, mineCount, board, false, true);
    for (const p of proofs.safe) fixed.set(p.index, 0);
    for (const p of proofs.mines) {
      if (fixed.has(p.index)) return fail("inconsistent");
      fixed.set(p.index, 1);
    }
  }
  const fixedMines = [...fixed.values()].filter((v) => v === 1).length;
  mineCount -= fixedMines;
  if (mineCount < 0) return fail("inconsistent");
  const covered: number[] = [],
    groups: Group[] = [],
    membership = new Map<number, number[]>();
  for (let i = 0; i < total; i++) {
    if (!board[i].revealed) {
      if (!fixed.has(i)) covered.push(i);
      continue;
    }
    const r = Math.floor(i / columns),
      c = i % columns,
      cells: number[] = [];
    let known = 0;
    for (let y = Math.max(0, r - 1); y <= Math.min(rows - 1, r + 1); y++)
      for (let x = Math.max(0, c - 1); x <= Math.min(columns - 1, c + 1); x++) {
        const j = y * columns + x;
        if (!board[j].revealed) {
          if (fixed.has(j)) known += fixed.get(j)!;
          else cells.push(j);
        }
      }
    const count = board[i].adjacentMines! - known;
    if (count < 0 || count > cells.length) return fail("inconsistent");
    if (!cells.length) continue;
    const g = groups.length;
    groups.push({ cells, count });
    for (const j of cells) {
      const list = membership.get(j) ?? [];
      list.push(g);
      membership.set(j, list);
    }
  }
  if (mineCount > covered.length) return fail("inconsistent");
  const outside = covered.filter((i) => !membership.has(i));
  const pending = new Set(membership.keys()),
    components: Component[] = [];
  const add = (map: Distribution, k: number, value: bigint) =>
    map.set(k, (map.get(k) ?? ZERO) + value);
  while (pending.size) {
    const seed = pending.values().next().value!;
    const cells = [seed],
      groupIds = new Set<number>();
    pending.delete(seed);
    for (let pos = 0; pos < cells.length; pos++)
      for (const g of membership.get(cells[pos])!) {
        if (groupIds.has(g)) continue;
        groupIds.add(g);
        for (const i of groups[g].cells) if (pending.delete(i)) cells.push(i);
      }
    if (cells.length > cap) return fail("limited");
    cells.sort((a, b) => membership.get(b)!.length - membership.get(a)!.length || a - b);
    const ids = [...groupIds],
      local = new Map(ids.map((id, j) => [id, j]));
    const left = ids.map((id) => groups[id].cells.length),
      needed = ids.map((id) => groups[id].count);
    const attached = cells.map((i) => membership.get(i)!.map((g) => local.get(g)!));
    const counts: Distribution = new Map(),
      hits: Distribution[] = cells.map(() => new Map());
    const assignment = cells.map(() => 0);
    function visit(depth: number, used: number) {
      if (limited) return;
      if (nodes >= nodeCap) {
        limited = true;
        return;
      }
      nodes++;
      if (used > mineCount) return;
      if (depth === cells.length) {
        if (needed.some((n) => n !== 0)) return;
        add(counts, used, ONE);
        for (let i = 0; i < cells.length; i++) if (assignment[i]) add(hits[i], used, ONE);
        return;
      }
      for (const v of [0, 1]) {
        assignment[depth] = v;
        let valid = true;
        for (const j of attached[depth]) {
          left[j]--;
          needed[j] -= v;
          if (needed[j] < 0 || needed[j] > left[j]) valid = false;
        }
        if (valid) visit(depth + 1, used + v);
        for (const j of attached[depth]) {
          left[j]++;
          needed[j] += v;
        }
        if (limited) return;
      }
    }
    visit(0, 0);
    if (limited) return fail("limited");
    if (!counts.size) return fail("inconsistent");
    components.push({ cells, counts, hits });
  }
  // Limit arithmetic work independently of DFS work. Sparse distributions are
  // truncated only above the public mine count, which cannot enter a valid layout.
  const tick = () => {
    if (work >= workCap) {
      limited = true;
      return false;
    }
    work++;
    return true;
  };
  function combine(a: Distribution, b: Distribution): Distribution {
    const result: Distribution = new Map();
    for (const [i, x] of a)
      for (const [j, y] of b) {
        if (!tick()) return result;
        if (i + j <= mineCount) add(result, i + j, x * y);
      }
    return result;
  }
  const unit = () => new Map([[0, ONE]]);
  const prefix: Distribution[] = [unit()],
    suffix: Distribution[] = Array(components.length + 1);
  suffix[components.length] = unit();
  for (const c of components) {
    prefix.push(combine(prefix[prefix.length - 1], c.counts));
    if (limited) return fail("limited");
  }
  for (let j = components.length - 1; j >= 0; j--) {
    suffix[j] = combine(components[j].counts, suffix[j + 1]);
    if (limited) return fail("limited");
  }
  // Exact binomial row for unconstrained covered cells.
  const weights = [ONE];
  for (let k = 1; k <= Math.min(outside.length, mineCount); k++) {
    if (!tick()) return fail("limited");
    weights.push((weights[k - 1] * BigInt(outside.length - k + 1)) / BigInt(k));
  }
  const weight = (k: number) => weights[k] ?? ZERO;
  let layouts = ZERO,
    outsideHits = ZERO;
  for (const [k, n] of prefix[components.length]) {
    if (!tick()) return fail("limited");
    const remaining = mineCount - k,
      w = weight(remaining);
    layouts += n * w;
    if (outside.length && w !== ZERO)
      outsideHits += (n * w * BigInt(remaining)) / BigInt(outside.length);
  }
  if (layouts === ZERO) return fail("inconsistent");
  const outsideCount = outsideHits.toString();
  const squares: { index: number; mineLayouts: string }[] = outside.map((index) => ({
    index,
    mineLayouts: outsideCount,
  }));
  for (let j = 0; j < components.length; j++) {
    const c = components[j],
      others = combine(prefix[j], suffix[j + 1]);
    if (limited) return fail("limited");
    const compatible: Distribution = new Map();
    for (const k of c.counts.keys()) {
      let n = ZERO;
      for (const [m, v] of others) {
        if (!tick()) return fail("limited");
        n += v * weight(mineCount - k - m);
      }
      compatible.set(k, n);
    }
    for (let i = 0; i < c.cells.length; i++) {
      let n = ZERO;
      for (const [k, h] of c.hits[i]) {
        if (!tick()) return fail("limited");
        n += h * compatible.get(k)!;
      }
      squares.push({ index: c.cells[i], mineLayouts: n.toString() });
    }
  }
  for (const [index, value] of fixed)
    squares.push({ index, mineLayouts: value === 1 ? layouts.toString() : "0" });
  squares.sort((a, b) => a.index - b.index);
  return {
    status: "complete",
    model: "uniform-compatible-layouts",
    totalLayouts: layouts.toString(),
    squares,
    nodes,
  };
}
