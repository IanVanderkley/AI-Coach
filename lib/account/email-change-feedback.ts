export const EMAIL_UNAVAILABLE_MESSAGE =
  "This email address is unavailable. Please use a different email address.";

// Only classify explicit provider errors; never query account existence.
export function isEmailUnavailable(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  return error.code === "email_exists" || error.code === "user_already_exists";
}
