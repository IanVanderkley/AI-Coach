export const PASSWORD_MIN = 8;
export function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
export function validUsername(value: string) {
  return /^[A-Za-z0-9_]{3,20}$/.test(value);
}
export function passwordProblem(password: string, confirmation: string): string | null {
  if (
    password.length < PASSWORD_MIN ||
    password.length > 72 ||
    new TextEncoder().encode(password).length > 72
  )
    return "Use 8–72 bytes for your new password (at least 8 characters).";
  if (password !== confirmation) return "Passwords do not match.";
  return null;
}
export function authError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error ? error.code : null;
  switch (code) {
    case "invalid_credentials":
      return "Email or password is incorrect.";
    case "email_not_confirmed":
      return "Confirm your email before signing in. You can request another verification email.";
    case "weak_password":
      return "Choose a stronger password and try again.";
    case "same_password":
      return "Choose a different password.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many requests. Wait before trying again.";
    case "otp_expired":
    case "flow_state_not_found":
    case "flow_state_expired":
      return "This link is expired or invalid. Request a new email.";
    default:
      return "Could not complete this request. Please try again.";
  }
}
export function callbackPath(
  kind: string | null,
): "/reset-password" | "/profile" | "/settings" {
  return kind === "recovery"
    ? "/reset-password"
    : kind === "email"
      ? "/settings"
      : "/profile";
}
export function confirmationMessage(kind: "signup" | "recovery") {
  return kind === "signup"
    ? "If this address can be registered, check your inbox for a confirmation email. If you already have an account, sign in or reset your password."
    : "If an account exists for that email, a password reset link will be sent. Check your inbox and spam folder.";
}
