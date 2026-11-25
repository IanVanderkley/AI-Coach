# Batch 22E — UI consistency

Shared geometry and scoped styling for dashboard cards, statistics, coaching, leaderboard, settings, and account controls. Dashboard actions align at the bottom while collapsed cards retain their natural height. The navbar stacks at tablet sizes and allows horizontal navigation scrolling on narrow phones rather than overflowing the page. Existing semantic colours and game-board/input rules are retained.

A single delegated, viewport-clamped tooltip serves explicitly marked `data-tip` elements, including replay controls and cells, level ring and general Practice tip. Hover and keyboard focus wait 200 ms; moving away, pressing Escape, navigation, scrolling, and touch dismiss or avoid the tooltip. Replay tooltip preference still controls replay attributes. Browser-native titles on unrelated elements are intentionally untouched. No new dependency, data migration, reward rule, or API change.

Validate keyboard focus, Escape, tooltip preference, board-edge tooltips, reduced motion, desktop/mobile layout, collapsed cards, auth/username settings, and both game modes locally. CSS applies last in RootLayout; it is scoped to named application controls to avoid touching board geometry or input behavior.
