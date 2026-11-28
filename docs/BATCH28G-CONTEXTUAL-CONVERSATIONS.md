# Batch 28G — Contextual coaching conversations

Base: `8cd6d9e` (`feature/batch-28f-training-exercises`).

## Scope

- Preserve move-specific rule-backed explanations; add a Whole game scope with summary, practice focus, and proven strengths prompts. Counts are the shared post-opening evidence report, not a lifetime profile or a newly computed replay. Representative examples use existing displayed move numbers and stable report references. A report without teaching moments can still produce an honest summary. Priority uses the highest occurrence count among the reported mistake categories, not a claim that every action was classified or that all possible mistake types were reported.
- Offer context-sensitive follow-up buttons anchored to the latest answer's explicit scope. These fill the question field for review and submission. The scope selector remains explicit; the coach does not infer arbitrary pronouns or invent conclusions. Whole-game free-text questions recognize only the listed prompts and a small set of equivalent phrases.
- Provide a direct replay link for the selected move and for answers containing a representative move. No replay link is shown for a whole-game answer without a valid representative move. Keep plain-language coordinates in responses.
- Preserve the 12-answer thread cap. Persist only question and scope/moment references in existing tab-local Practice storage; regenerate answers from current evidence. Ranked remains memory-only. No additional network calls, paid AI, database writes, XP/Elo changes, or deployment.

## Verification

12 new tests and 314 combined isolated tests passed, excluding the legacy shared-analysis test whose dependencies are unavailable in the fixture. Core TypeScript checks and changed TSX syntax validation passed. Full application tests, TypeScript, production build and browser smoke checks are required locally.
