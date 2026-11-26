# Batch 23D — Rank emblem rendering

The `RankEmblem` component combines the eight original WebP assets with a vector Roman numeral centred at (320, 350) on the shared 640 × 640 canvas. The I and V glyphs form all five divisions, use a pale metallic fill and dark outline, and scale with the badge without relying on a browser font. Omniscient never has a numeral. The original asset files are unchanged.

Use `rating` from the authenticated account or verified match receipt. `size` controls the maximum intended display size, `showDivision={false}` supports tier-only milestones, and `decorative` hides redundant accessibility labels when adjacent text identifies the rank. No component state, award mechanism, manual rating input, preview slider or public showcase route is included.

Next: integrate the component into the Ranked lobby, then the results, profile and leaderboard. The lobby is separate from active gameplay; keep existing verified match recovery and resume behaviour, and return to the lobby after results. Highest achieved rank requires separate server-owned history work. Do not deploy the new interface or apply the hosted Elo migration until the full rollout is coordinated.
