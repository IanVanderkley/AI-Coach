# Batch 25C.4 — Ranked Coaching interface

- Private metadata-only history endpoint: latest ten terminal matches; owner, active session, rate limit and official wins checked. Profile history still omits IDs.
- Explicit review from Ranked history or result dialog. The existing secure recording endpoint performs server analysis; browser reconstructs the interactive replay and checks agreement with the server summary. No provider call for Ranked. No gameplay or competitive reward writes.
- Shared grade, replay, proofs and follow-ups. Ranked labels and neutral evidence caveat. Ranked follow-ups are in-memory only for now; Practice tab persistence is unchanged. Persistent account-scoped history is deferred to 25D.
- Recordings over the existing 1,000-move limit are marked unavailable; other integrity failures are surfaced on selection. Completed placements may be reviewed without hidden rating data.

Local acceptance: sign in, open Coaching, select a completed Ranked loss and victory, inspect proof and follow-up, return to history, open Review game from result dialog, try direct link, check a guest and unavailable match, then regress Practice history/grades/follow-ups. Full two-account and session revocation tests remain Batch 25C.5. No deployment or database migrations.
