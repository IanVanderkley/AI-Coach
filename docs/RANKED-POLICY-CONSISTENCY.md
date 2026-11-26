# Batch 23G.3b — Current rank contract

The public leaderboard identifies the current solo rating policy as `solo-elo-benchmark-v2`. Existing saved ratings (including ratings earned under v1) remain unchanged. The identifier describes the current policy, not the policy used to award every historical point. Deploy only after the local-only v2 and Gold-start migrations are coordinated with the matching application release. Stale clients expecting v1 must refresh.

The retired cosmetic five-tier helper, its unused styles and the old calculation in the public standings module are removed. Rank policy v2 is the single source for rank presentation and reference calculations. Historical migrations, v1 receipt parsing, privacy-filtered SQL views, rate limits and server-controlled awards are unchanged. The inactive RP flag is retained as an explicit guard; no placements or head-to-head matchmaking are introduced.

Verify the full test suite, both public boards, the profile, and privacy settings locally. No migration or hosted deployment is part of this patch.
