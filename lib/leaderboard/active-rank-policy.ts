/** Server and read projections switch together with the guarded v4 migration. */
export const ACTIVE_RANK_POLICY_VERSION = 4 as const;
// Write contract v5 requires final-guess-aware settlement and receipt readers.
export const RANKED_WRITE_CONTRACT_VERSION = 5 as const;
