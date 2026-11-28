# Batch 28E.5b — Saved skill evidence and dashboard polish

- Optional `review.skillEvidence` version 1 is generated on the existing authorized save path from the same prepared replay; existing JSONB schema is unchanged. No additional replay, provider call or database write is required on history load.
- Old reports retain overall statistics. Re-open original recordings and unsave/save to collect new skill evidence; no automatic backfill or rewrite. Deleted/unavailable recordings cannot be enriched.
- Individual skill percentages require at least ten assessed actions across three games. Uncertain actions are excluded from accuracy, not treated as errors; unflags are excluded from individual rates. Risk management is an overlapping reveal/chord subset, not a separate total.
- The dashboard appears before match history; the recommendation precedes detailed history; historical table is independently collapsible. Practice and Ranked remain separate. UI targets the selected mode for the three-game plan.
- Staging catalog inspection: existing review constraint is JSONB object with at most 65536 bytes. No migration or remote mutation. Verify saves and deletes locally, including old and new reports, account switches, narrow layout, and existing replay links before commit.

## Compact learning details

Overview and suggested focus remain visible; the new native More learning details disclosure starts closed on mount. It contains the drill, training plan, progress/history, skill evidence, methodology, mistake patterns and saved reports. Existing individual section preferences remain intact. Try quick drill opens the outer disclosure before opening and focusing the drill. No changes to data or saving.
