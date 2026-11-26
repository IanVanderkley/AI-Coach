import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { competitiveRank, RANK_DEFINITIONS } from "../lib/leaderboard/rank-policy.ts";
import {
  EMBLEM_CANVAS,
  EMBLEM_MINE_CENTER,
  numeralGeometry,
  rankEmblemModel,
} from "../lib/leaderboard/rank-emblem.ts";

test("all 34 rank milestones use the original eight assets and correct divisions", () => {
  const labels = new Set();
  for (let rating = 100; rating <= 10000; rating++) {
    const rank = competitiveRank(rating);
    const emblem = rankEmblemModel(rating);
    assert.equal(emblem.label, rank.label);
    assert.equal(emblem.division, rank.division);
    assert.ok(existsSync(`public${emblem.src}`));
    assert.equal(emblem.glyphs.length, rank.division?.length ?? 0);
    labels.add(emblem.label);
  }
  assert.equal(labels.size, 34);
});

test("all division glyphs are centred inside the shared mine canvas", () => {
  assert.equal(EMBLEM_CANVAS, 640);
  for (const division of ["I", "II", "III", "IV", "V"]) {
    const glyphs = numeralGeometry(division);
    const first = glyphs[0];
    const last = glyphs.at(-1);
    assert.equal((first.x + last.x + last.width) / 2, EMBLEM_MINE_CENTER.x);
    for (const glyph of glyphs) {
      assert.equal(glyph.y + glyph.height / 2, EMBLEM_MINE_CENTER.y);
      assert.ok(glyph.x >= 280 && glyph.x + glyph.width <= 360);
      assert.ok(glyph.path.startsWith("M"));
    }
  }
});

test("Omniscient is always numeral-free; tier milestones can omit divisions", () => {
  for (const rating of [3400, 5000, 10000]) {
    assert.deepEqual(rankEmblemModel(rating).glyphs, []);
    assert.equal(rankEmblemModel(rating).label, "Omniscient");
  }
  for (const { name, min } of RANK_DEFINITIONS) {
    const milestone = rankEmblemModel(min, false);
    assert.equal(milestone.label, name);
    assert.equal(milestone.division, null);
    assert.deepEqual(milestone.glyphs, []);
  }
});

test("invalid saved ratings and invalid division strings are rejected", () => {
  for (const rating of [99, 10001, 100.5, NaN, Infinity, null, "1000"]) {
    assert.throws(() => rankEmblemModel(rating), RangeError);
  }
  for (const division of ["VI", "IIII", "", "X"]) {
    assert.throws(() => numeralGeometry(division), RangeError);
  }
});

test("component uses accessible, fixed-coordinate display artwork without rating controls", () => {
  const source = readFileSync("components/ranked/rank-emblem.tsx", "utf8");
  assert.match(source, /rankEmblemModel\(rating, showDivision\)/);
  assert.match(source, /<image href=\{emblem.src\}/);
  assert.match(source, /aria-label=\{decorative \? undefined : emblem.label\}/);
  assert.match(source, /emblem.glyphs.map/);
  assert.doesNotMatch(source, /useState|onChange|type="range"|fetch\(/);
});
