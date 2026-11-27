# Batch 25B.3 — Collapsible coaching history

Practice history now has its own accessible toggle, reusing the existing Ranked history control and styles. Both start expanded, preserving the profile deep links and current default behavior. Practice collapse state survives opening a review and returning to history during the same mounted Coaching workspace. Ranked retains its existing independent toggle and resets when remounted. The Practice match count and error message remain visible above the collapsed content.

Collapsing the list hides it, rather than removing recordings or interrupting loading and automatic grading. No changes to repository queries, ownership, history limits, grades, settings, Ranked records, or provider usage. This is a presentation-only change, not a persistent account preference.

Manual check: independently collapse and expand Practice and Ranked, confirm the Practice count is still visible, open a saved review and return, verify grade and review links, test keyboard Tab and Enter/Space, and check profile links to both headings. Check empty and guest history states. No migration or deployment required.
