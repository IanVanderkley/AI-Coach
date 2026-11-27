import type { RankNumeral } from "./rank-policy.ts";
import { displayRank, type RankDisplayVersion } from "./rank-display.ts";

export const EMBLEM_CANVAS = 640;
export const EMBLEM_MINE_CENTER = { x: 320, y: 350 } as const;

// Small serif glyphs drawn as vectors, not font-dependent text. The same geometry
// scales with the original artwork at every display size.
const GLYPHS = {
  I: { width: 20, path: "M0 0H20V7H14V59H20V66H0V59H6V7H0Z" },
  V: { width: 49, path: "M0 0H19V7H14L25 49L36 7H31V0H49V7H43L29 66H21L6 7H0Z" },
} as const;
const GLYPH_HEIGHT = 66;
const GLYPH_GAP = 5;

export function numeralGeometry(numeral: RankNumeral | null) {
  if (numeral === null) return [];
  if (!/^(I|II|III|IV|V)$/.test(numeral)) {
    throw new RangeError("Invalid rank division.");
  }
  const letters = [...numeral] as (keyof typeof GLYPHS)[];
  const width =
    letters.reduce((sum, letter) => sum + GLYPHS[letter].width, 0) +
    (letters.length - 1) * GLYPH_GAP;
  let x = EMBLEM_MINE_CENTER.x - width / 2;
  return letters.map((letter) => {
    const glyph = GLYPHS[letter];
    const positioned = {
      path: glyph.path,
      x,
      y: EMBLEM_MINE_CENTER.y - GLYPH_HEIGHT / 2,
      width: glyph.width,
      height: GLYPH_HEIGHT,
    };
    x += glyph.width + GLYPH_GAP;
    return positioned;
  });
}

/** Display-only model. The supplied rating must come from the verified account or receipt. */
export function rankEmblemModel(rating: number, showDivision = true, version: RankDisplayVersion = 3) {
  const rank = displayRank(rating, version);
  const division = showDivision ? rank.division : null;
  return {
    name: rank.name,
    label: division ? rank.label : rank.name,
    src: `/ranks/${rank.name.toLowerCase()}.webp`,
    division,
    glyphs: numeralGeometry(division),
  };
}
