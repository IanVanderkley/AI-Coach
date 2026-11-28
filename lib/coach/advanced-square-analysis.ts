import { calculateComponentProbabilities, calculateReducedComponentProbabilities } from "./component-probabilities.ts";
import { deduceVisibleBoard, type VisibleCell, type OverlapProof } from "./verified-replay.ts";
import { explainSquare, type SquareAnalysis } from "./square-analysis.ts";

/** On-demand post-game inspection only. Never use this for grades or live moves. */
export function analyzeAdvancedSnapshot(rows: number, columns: number, mineCount: number, board: readonly VisibleCell[]) {
  const initial = calculateComponentProbabilities(rows, columns, mineCount, board);
  const probability = initial.status === "limited" ? calculateReducedComponentProbabilities(rows, columns, mineCount, board) : initial;
  const valid = probability.status === "complete" || probability.status === "limited";
  const deductions = valid ? deduceVisibleBoard(rows, columns, mineCount, board, true, true) : { safe: [], mines: [] };
  const safe = new Set(deductions.safe.map(p => p.index));
  const mines = new Set(deductions.mines.map(p => p.index));
  const proofs = new Map([...deductions.safe, ...deductions.mines].map(p => [p.index, p]));
  // A complete independent enumeration must agree with every rule proof.
  const conflict = probability.status === "complete" && probability.squares.some(s =>
    (safe.has(s.index) && s.mineLayouts !== "0") || (mines.has(s.index) && s.mineLayouts !== probability.totalLayouts));
  return { probability, context: { board, columns, terminal: probability.status === "terminal", safe, mines, proofs }, conflict };
}
export type AdvancedSnapshot = ReturnType<typeof analyzeAdvancedSnapshot>;

/** Keep strict inequalities for nonzero risks even at extreme magnitudes. */
export function riskPercent(n: bigint, d: bigint): string {
  if (d <= BigInt(0) || n < BigInt(0) || n > d) throw new Error("Invalid risk fraction");
  if (n === BigInt(0)) return "0%";
  if (n === d) return "100%";
  const scaled = n * BigInt(10000);
  if (scaled < d) return "<0.01%";
  if ((d - n) * BigInt(10000) < d) return ">99.99%";
  const rounded = (scaled + d / BigInt(2)) / d;
  return `${Number(rounded) / 100}%`;
}

export function inspectAdvanced(snapshot: AdvancedSnapshot, index: number) {
  const { probability, context, conflict } = snapshot;
  if (conflict || !Number.isInteger(index) || !context.board[index] || context.board[index].revealed ||
      (probability.status !== "complete" && probability.status !== "limited")) return null;
  const rule = explainSquare(context, index);
  const proof = rule && (rule.classification === "proven-safe" || rule.classification === "proven-mine") ? rule : null;
  let risk: { mine: string; survival: string; numerator: string; denominator: string; certainty: "safe" | "mine" | "uncertain"; lower: number[]; best: number[]; bestMine: string | null; adjacentClues: number; sameRiskCount: number; comparison: { index: number; mine: string } | null } | null = null;
  if (probability.status === "complete") {
    const entry = probability.squares.find(s => s.index === index);
    if (!entry) return null;
    const d = BigInt(probability.totalLayouts), n = BigInt(entry.mineLayouts);
    const candidates = probability.squares.filter(s => !context.board[s.index].flagged && s.index !== index);
    const lower = candidates.filter(s => BigInt(s.mineLayouts) < n);
    const min = lower.reduce((v, s) => BigInt(s.mineLayouts) < v ? BigInt(s.mineLayouts) : v, n);
    const row = Math.floor(index / context.columns), col = index % context.columns;
    let adjacentClues = 0;
    for (let r = Math.max(0, row - 1); r <= Math.min(context.board.length / context.columns - 1, row + 1); r++) {
      for (let c = Math.max(0, col - 1); c <= Math.min(context.columns - 1, col + 1); c++) {
        const cell = context.board[r * context.columns + c];
        if (cell.revealed && !cell.exploded && cell.adjacentMines !== null) adjacentClues++;
      }
    }
    const sameRiskCount = probability.squares.filter(s => s.index !== index && s.mineLayouts === entry.mineLayouts).length;
    const selectedPercent = riskPercent(n,d);
    // Offer a genuinely different uncertain square as a useful comparison, not a guaranteed move.
    const other = candidates.find(s => {
      const hits = BigInt(s.mineLayouts);
      return hits > BigInt(0) && hits < d && hits !== n && riskPercent(hits,d) !== selectedPercent;
    });
    const comparison = other ? { index: other.index, mine: riskPercent(BigInt(other.mineLayouts),d) } : null;
    risk = { adjacentClues, sameRiskCount, comparison, mine: selectedPercent, survival: riskPercent(d-n,d), numerator: entry.mineLayouts, denominator: probability.totalLayouts,
      certainty: n === BigInt(0) ? "safe" : n === d ? "mine" : "uncertain", lower: lower.map(s => s.index), best: lower.filter(s => BigInt(s.mineLayouts) === min).map(s => s.index), bestMine: lower.length ? riskPercent(min,d) : null };
  }
  return { proof, risk, status: probability.status };
}

/** Highlight a genuine overlap certificate, including prerequisite deductions. */
export function overlapEvidence(analysis: SquareAnalysis): OverlapProof | undefined {
  return [...analysis.explanation.steps].reverse().find(s => s.overlap)?.overlap;
}
export function overlapRegions(proof: OverlapProof) {
  const [a,b] = proof.groups;
  const setA = new Set(a.cells), setB = new Set(b.cells);
  return { onlyA: a.cells.filter(i => !setB.has(i)), onlyB: b.cells.filter(i => !setA.has(i)), shared: a.cells.filter(i => setB.has(i)) };
}
