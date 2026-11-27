import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync,readdirSync} from "node:fs";
import {isRankedXpReward,parsePracticeXpReceipt} from "../lib/levels/rewards.ts";
test("Ranked reward parser accepts exact legacy and current amounts only",()=>{
 for(const n of [125,210,350]) assert.equal(isRankedXpReward("won",n),true);
 for(const n of [0,10,17,50]) assert.equal(isRankedXpReward("lost",n),true);
 for(const n of [0,50,349,351,"350"]) assert.equal(isRankedXpReward("won",n),false);
 for(const n of [125,210,350,49,51,"50",-1]) assert.equal(isRankedXpReward("lost",n),false);
});
test("Practice accepts exact old and doubled rewards without rewriting receipts",()=>{
 for(const [difficulty,w,l] of [["Beginner",25,5],["Intermediate",50,10],["Expert",75,15]]) {
  for(const [outcome,base] of [["win",w],["loss",l]]) {
   for(const amount of [base,base*2]) { const r={difficulty,outcome,amount,reason:"earned"}; assert.deepEqual(parsePracticeXpReceipt(r),r); }
   for(const amount of [0,base+1,base*2+1,String(base*2)]) assert.throws(()=>parsePracticeXpReceipt({difficulty,outcome,amount,reason:"earned"}));
   for(const reason of ["participation","daily_limit"]) {assert.equal(parsePracticeXpReceipt({difficulty,outcome,amount:0,reason}).amount,0);assert.throws(()=>parsePracticeXpReceipt({difficulty,outcome,amount:base,reason}));}
  }
 }
});
test("v2 SQL preserves verified triggers, exact constraints, atomic reservations and private ACLs",()=>{
 const files=readdirSync("supabase/migrations").filter(n=>/^\d+_xp_economy_v2\.sql$/.test(n));assert.equal(files.length,1);
 const sql=readFileSync("supabase/migrations/"+files[0],"utf8");
 assert.match(sql,/v_match\.duration_ms >= 15000 and v_actions >= 3/);
 assert.match(sql,/count\(distinct \(row_index, column_index\)\)/);
 assert.match(sql,/v_recorded_match is not null and v_amount > 0/);
 assert.match(sql,/c\.amount \+ EXCLUDED\.amount <= 500/);
 assert.match(sql,/amount IN \(125,210,350\)/);
 assert.match(sql,/amount IN \(0,10,17,50\)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION xp_internal\.award_verified_ranked_loss_xp\(\) FROM PUBLIC, anon, authenticated, service_role/);
 assert.doesNotMatch(sql,/UPDATE public\.player_xp_match_receipts SET/i);
});
