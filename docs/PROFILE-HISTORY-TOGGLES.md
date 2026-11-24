# Profile history collapse controls

Both history cards start expanded. The title button toggles only its own section using native button keyboard behavior, `aria-expanded`, and a matching `aria-controls` target. The count remains visible when collapsed; the data stays in memory and isn't deleted. The Practice heading is **Recent Practice Matches**; Ranked is **Recent Ranked Matches**. The state is local to the open page and resets to expanded after navigation or refresh. No backend permissions, database migrations, XP calculations, or Ranked game rules are touched.

Verification: run `npm run check`, `npm test`, and test both toggles with mouse and keyboard on `/profile`; confirm the two histories can be collapsed/expanded independently and that the counts and match rows return unchanged.
