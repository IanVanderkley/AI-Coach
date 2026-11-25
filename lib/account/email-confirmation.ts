// A presentation-only hint from Supabase. Never use this to authorize an action.
const FIRST_CONFIRMATION =
  "Confirmation link accepted. Please proceed to confirm link sent to the other email";

export function isFirstEmailConfirmation(params: URLSearchParams): boolean {
  return (
    params.getAll("kind").length === 1 &&
    params.get("kind") === "email" &&
    !params.has("code") &&
    !params.has("error") &&
    !params.has("error_code") &&
    !params.has("error_description") &&
    params.getAll("message").length === 1 &&
    params.get("message") === FIRST_CONFIRMATION
  );
}
