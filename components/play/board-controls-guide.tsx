"use client";

import { Clock3, Flag, Grid2X2, MousePointer2, ScanLine } from "lucide-react";
import { useBoardGuide } from "@/lib/settings/board-guide";

/** Shared presentation only: these instructions do not handle board input. */
export function BoardControlsGuide({
  mode,
  rows,
  columns,
  mines,
}: {
  mode: "practice" | "ranked";
  rows: number;
  columns: number;
  mines: number;
}) {
  const { enabled } = useBoardGuide();
  if (!enabled) return null;
  const ranked = mode === "ranked";
  return (
    <section className="board-controls-guide" aria-label="Board controls guide">
      <header className="board-guide-heading">
        <div className="board-guide-title">
          <span className="board-guide-icon" aria-hidden="true">
            <Grid2X2 size={17} />
          </span>
          <div>
            <h3>Board controls</h3>
            <span className="board-guide-mode">
              {ranked ? "Ranked" : "Practice"} · Quick reference
            </span>
          </div>
        </div>
        <span className="board-guide-dimensions">
          {rows} × {columns} · {mines} mines
        </span>
      </header>
      <div className="board-guide-grid">
        <div className="board-guide-item">
          <MousePointer2 size={18} aria-hidden="true" />
          <div>
            <strong>Reveal</strong>
            <p>In Reveal mode, click or tap a covered square.</p>
          </div>
        </div>
        <div className="board-guide-item">
          <Flag size={18} aria-hidden="true" />
          <div>
            <strong>Flag</strong>
            <p>Right-click, or tap a square in Flag mode.</p>
          </div>
        </div>
        <div className="board-guide-item">
          <ScanLine size={18} aria-hidden="true" />
          <div>
            <strong>Chord</strong>
            <p>
              In Reveal mode, tap a number when its adjacent flags match.
              {!ranked && " Left + right click also works."}
            </p>
          </div>
        </div>
      </div>
      {ranked && (
        <div className="board-guide-clock">
          <Clock3 size={16} aria-hidden="true" />
          <div>
            <strong>Ranked clock</strong>
            <p>Time continues after your first reveal, even when you leave the page.</p>
          </div>
        </div>
      )}
    </section>
  );
}
