# Batch 27H.1a — Coaching history cleanup

Normal Coaching history shows only Practice, Ranked, and learning progress. The experimental samples remain accessible only in a local development build via /coaching?devSamples=1. No new public-facing experimental feature or provider configuration is added. Removed public settings controls for the retired cards; stored keys remain compatible. Ranked refresh is in the expanded history body (including error recovery), and the Profile variant retains its existing header refresh and scope note.

## FAQ handoff (27I)
- Replays and visual lessons use visible-board evidence; uncertain moves are not classified as verified mistakes just because a mine was hit. Learning scores are separate from Ranked Elo and account XP.
- Ranked history displays up to ten completed Intermediate matches; recent counts are not lifetime statistics. Practice history displays retained recordings. Saved account lifetime statistics are separate from retained replay history.
- Automatic grades depend on the user's preferences and recording availability; unavailable Ranked grades can be retried via Refresh matches. Optional AI is not necessary for rule-based coaching.
- A future dedicated training/pattern library would be a separate feature, not a placeholder card.

No changes to database, analysis engine, permissions, provider flags or history limits.
