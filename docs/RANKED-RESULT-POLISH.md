# Ranked result polish (Batch 23F)

Match ratings come from the existing owner-scoped receipt route. The policy version is returned with the receipt; historical v1 events retain their stored values, while v2 deltas are checked against the verified calculation. Historical v1 ratings are displayed on the current rank scale without claiming a v2 promotion. The UI never awards or changes points.

Results display the new emblem and division, actual before/change/after values, progress toward the next division, and promotion/demotion feedback when a v2 receipt crosses a boundary. Omniscient has no next division. Reduced-motion preferences disable the rank animation. Gameplay gets more compact heading spacing; the lobby, board controls, recovery and server move handlers are unchanged.

Requires the existing local v2 migration. Before deployment, verify a real local loss and win, including a victory worth more than 32, a return to lobby, and a promotion or demotion if practical. Existing receipt and XP behaviour must remain intact. No new SQL migration or hosted deployment.
