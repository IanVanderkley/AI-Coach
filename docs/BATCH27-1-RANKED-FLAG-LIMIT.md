# Batch 27.1 — Ranked flag-limit UX

The existing server enforces a maximum of 40 flags and rejects excess placements. The previous client treated every rejected move as an ambiguous transaction and recovered the board. The client now blocks a new flag when its confirmed visible state is at the cap, before assigning an in-flight revision or issuing an RPC. Both immediate and queued toggles use the same guard. Unflag, reveal and chord remain available. The existing status row announces the limit while active; it uses only the public flag count and never indicates which flags are right or wrong. True stale revisions, unexpected errors and ambiguous requests continue to use the original recovery path.

No API, SQL, auth, award, scoring or dependency changes. Flagging alone does not win a game; reveal all safe cells.

Browser check: reach 39 flags, place the 40th, try another covered square repeatedly (right-click and Flag mode); no flag POST or board recovery should occur. Unflag an existing square, place another, verify the next valid move succeeds. Try queued clicks across the limit, and check warning clears after unflagging and is absent on terminal boards. Confirm match ID, timer and confirmed move count are preserved. Use a local/test match, not an important live match.
