# Batch 25B.5 — Responsive and accessible review

Presentation only. Adds an on-demand row-by-row text alternative to each displayed replay board, including only visible cell facts and the enabled deduction overlays. No hidden mine layout is read by the text helper. The visual board stays read-only. Narrow-screen spacing, controls, text wrapping, focus outlines, and scroll containers are scoped to Coaching. No scoring, auth, database or provider changes.

## Local acceptance checklist

Run `npm run dev:local`. Check at desktop width, 768px and 375px (DevTools responsive mode is sufficient for initial layout testing). Use completed Beginner and Expert Practice recordings; inspect win and loss where available.

- No page-level horizontal overflow; large boards and cropped proof diagrams scroll inside their own panels.
- Before/After/Compare, timeline keyboard arrows, playback and lesson links still work.
- Open board text; compare selected coordinates, flags, clues and deductions against the visual board. Toggle deductions off; text must no longer show deduction overlays. After board has no deduction overlay.
- Tab through all controls, including board scroll and proof steps. Focus is visible; collapsed history controls reopen normally.
- Open detailed proofs; Next/Previous and Show all steps keep the proof order. Preferences do not change grade or facts.
- Ask multiple supported questions, reject an unsupported hypothetical, reopen same game, clear conversation. No unexpected jump or network/provider request.
- No browser console errors. Test loading/empty/error views and keyboard-only navigation. Screen reader/device testing remains a manual acceptance task.

Tests are source contracts and deterministic helper checks, not browser layout tests. No deployment until local validation and later Batch 25 release checks.
