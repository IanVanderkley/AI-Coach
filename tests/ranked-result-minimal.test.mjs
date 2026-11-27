import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = p => readFileSync(p,"utf8");
test("Ranked result header is minimal and all original actions survive", () => {
 const d=read("components/ranked/ranked-result-dialog.tsx");
 assert.doesNotMatch(d,/RANKED MATCH COMPLETE|A mine ended this run/);
 assert.match(d,/Ranked · Intermediate/);
 for (const action of ["onPlayAgain","onReturnLobby","onDismiss","Analyze Game","Share result","Copy result","View finished board"]) assert.ok(d.includes(action));
 assert.match(d,/ranked-result-note sr-only/);
});
test("Ranked XP stays receipt-backed and zero is not a fallback",()=>{
 const x=read("components/ranked/ranked-match-xp-receipt.tsx");
 assert.match(x,/result\.outcome === expectedOutcome/);
 assert.match(x,/state\.kind === "earned"[\s\S]*?\+\{state\.amount\.toLocaleString\(\)\} XP/);
 assert.doesNotMatch(x,/Loss did not qualify/);
 assert.match(x,/No saved XP receipt for this match/);
 const p=read("components/ranked/ranked-xp-progress.tsx");
 assert.match(p,/calculateLevelProgress\(account\.totalXp\)/);
 assert.match(p,/aria-valuenow=\{progress\.xpIntoLevel\}/);
});
test("Ranked-only minimal stylesheet loads last, preserves special events and adds no animation",()=>{
 const css=read("styles/ranked-result-minimal.css");
 const layout=read("app/layout.tsx");
 assert.ok(layout.indexOf('import "../styles/ranked-result-minimal.css";') > layout.indexOf('import "../styles/practice-result-minimal.css";'));
 assert.match(css,/width: min\(94vw, 560px\)/);
 assert.doesNotMatch(css,/\.practice-result-dialog|\.cell\b|animation\s*:/);
 for(const s of ['data-transition="promotion"','data-transition="demotion"','data-feedback-tone="reward"','data-feedback-tone="protection"']) assert.ok(css.includes(s));
 assert.match(css,/:focus-visible/);
});
