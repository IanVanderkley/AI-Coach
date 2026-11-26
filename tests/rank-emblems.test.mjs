import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { RANK_DEFINITIONS } from "../lib/leaderboard/rank-policy.ts";

const hashes = {
  "bronze.webp": "b77cfd6683436cfa5bb8dfe5942d4e07072e42ddeb1546a487963d8aa0c58423",
  "copper.webp": "920034a8cece9ee0604f5f368e6729aad679691d7f8effc80f063b1047243583",
  "diamond.webp": "4b894b780dbb8d0abe50b3db0eba9915fd353a4434ed43c2247b81dc69ddb34a",
  "emerald.webp": "9dcb2ab2253c118b36463186199313a1a01d455e7d2a9c7cfac48b525c1884c3",
  "gold.webp": "210b57e8c5c6fd59854114c702c7819bd68376ef72f37c7513c39ce88037a6d6",
  "omniscient.webp": "5045883d4b75a1776b6b1c7ad1729fd7fdfff2efc5738cdb5a039bd55fdc7eab",
  "platinum.webp": "3ab6b5474533fa45c67f87e653d0e81b239c4d7dce3694c5831de2862ae93b65",
  "silver.webp": "bda81cd713435a8523890fd7734641e3f0699df3061d11dc2ea5041797489688",
};

test("eight original rank emblem assets match the rank policy", () => {
  const expected = RANK_DEFINITIONS.map(
    ({ name }) => `${name.toLowerCase()}.webp`,
  ).sort();
  assert.deepEqual(readdirSync("public/ranks").sort(), expected);
  for (const name of expected) {
    const bytes = readFileSync(`public/ranks/${name}`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), hashes[name]);
  }
});

test("rank assets are transparent 640px square WebP images", () => {
  for (const { name } of RANK_DEFINITIONS) {
    const bytes = readFileSync(`public/ranks/${name.toLowerCase()}.webp`);
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.readUInt32LE(4) + 8, bytes.length);
    assert.equal(bytes.toString("ascii", 8, 16), "WEBPVP8X");
    assert.ok(bytes[20] & 0x10, "Missing alpha flag");
    assert.equal(bytes.readUIntLE(24, 3) + 1, 640);
    assert.equal(bytes.readUIntLE(27, 3) + 1, 640);
    assert.ok(bytes.length < 150_000);
  }
});
