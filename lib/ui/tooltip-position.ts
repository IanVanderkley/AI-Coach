export const TOOLTIP_DELAY_MS = 200;
export const TOOLTIP_HIDE_MS = 120;

/** Keep a viewport-positioned tip inside the available screen, even at board edges. */
export function tooltipPosition(
  anchor: { left: number; right: number; top: number; bottom: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
) {
  const inset = 8;
  const gap = 8;
  const clamp = (value: number, max: number) => Math.max(inset, Math.min(value, max));
  const above = anchor.top - size.height - gap;
  const below = anchor.bottom + gap;
  return {
    left: clamp(
      (anchor.left + anchor.right - size.width) / 2,
      viewport.width - size.width - inset,
    ),
    top: clamp(above >= inset ? above : below, viewport.height - size.height - inset),
  };
}
