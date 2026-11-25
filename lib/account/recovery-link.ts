/** A recovery token is a bearer credential. Keep it in memory, not storage. */
export function readRecoveryToken(fragment: string): string | null {
  if (!fragment.startsWith("#") || fragment.length > 600) return null;
  const params = new URLSearchParams(fragment.slice(1));
  const tokens = params.getAll("recovery_token");
  if (tokens.length !== 1 || Array.from(params.keys()).length !== 1) return null;
  return /^[A-Za-z0-9_-]{20,512}$/.test(tokens[0]) ? tokens[0] : null;
}
