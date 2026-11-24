/** Ranked availability is authoritative. Do not expose unimplemented game modes as playable. */
export const RANKED_LADDERS = [
  {
    id: "beginner",
    label: "Beginner",
    rows: 9,
    columns: 9,
    mineCount: 10,
    playable: false,
  },
  {
    id: "intermediate",
    label: "Intermediate",
    rows: 16,
    columns: 16,
    mineCount: 40,
    playable: true,
  },
  {
    id: "expert",
    label: "Expert",
    rows: 16,
    columns: 30,
    mineCount: 99,
    playable: false,
  },
] as const;

export type RankedDifficulty = (typeof RANKED_LADDERS)[number]["id"];

/** RP is deliberately not calculated: no placement or rating policy has been approved. */
export const RANKED_RP_ENABLED = false;
