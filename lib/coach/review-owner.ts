/** A changed session owner invalidates account-derived review state. The first
 * INITIAL_SESSION establishes a baseline without interrupting a deep link. */
export function reviewOwnerTransition(previous: string | null | undefined, event: string, next: string | null): { owner: string | null | undefined; reset: boolean } {
  if (event === "INITIAL_SESSION") return { owner: next, reset: previous !== undefined && previous !== next };
  if (event === "SIGNED_OUT") return { owner: null, reset: true };
  if (next === null) return { owner: previous, reset: false };
  return { owner: next, reset: previous !== next };
}
