/** Nearest vertical scroll that exposes the controls and board where possible. */
export function gameViewportScrollDelta({
  panelTop,
  boardTop,
  boardBottom,
  viewportTop,
  viewportBottom,
}: {
  panelTop: number;
  boardTop: number;
  boardBottom: number;
  viewportTop: number;
  viewportBottom: number;
}): number {
  const height = viewportBottom - viewportTop;
  if (height <= 0 || boardBottom <= boardTop) return 0;
  const nearest = (top: number) => {
    const minimum = boardBottom - viewportBottom;
    const maximum = top - viewportTop;
    return Math.max(minimum, Math.min(0, maximum));
  };
  if (boardBottom - panelTop <= height) return Math.round(nearest(panelTop));
  if (boardBottom - boardTop <= height) return Math.round(nearest(boardTop));
  // A tall board cannot fit at once: start at its top without shrinking the cells.
  return Math.round(boardTop - viewportTop);
}
