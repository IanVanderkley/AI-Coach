"use client";

import { useEffect, useRef, type RefObject } from "react";
import { gameViewportScrollDelta } from "@/lib/game-viewport-scroll";

/** Run once per deliberate board entry, never for ordinary move/timer updates. */
export function useGameViewportScroll(
  panelRef: RefObject<HTMLElement | null>,
  entryKey: string | null,
) {
  const handledEntry = useRef<string | null>(null);
  useEffect(() => {
    if (entryKey === null || handledEntry.current === entryKey) return;
    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      const board = panel?.querySelector<HTMLElement>(".board-area");
      if (!panel || !board) return;
      const header = document.querySelector<HTMLElement>(".site-header");
      const headerPosition = header ? window.getComputedStyle(header).position : "";
      const headerHeight =
        header && (headerPosition === "fixed" || headerPosition === "sticky")
          ? header.getBoundingClientRect().height
          : 0;
      const bounds = board.getBoundingClientRect();
      const delta = gameViewportScrollDelta({
        panelTop: panel.getBoundingClientRect().top,
        boardTop: bounds.top,
        boardBottom: bounds.bottom,
        viewportTop: headerHeight + 8,
        viewportBottom: window.innerHeight - 8,
      });
      handledEntry.current = entryKey;
      // Instant positioning avoids interfering with the first move or reduced motion.
      if (Math.abs(delta) >= 1) window.scrollBy({ top: delta, behavior: "instant" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [entryKey, panelRef]);
}
