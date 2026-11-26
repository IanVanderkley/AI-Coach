// Presentation only: URL parameters never establish a verified identity.
export function authLinkFailurePath(kind: string | null): string {
  if (kind === "email") return "/auth/email-change?status=error#email-change";
  const error = kind === "signup" || kind === "recovery" ? kind : "link";
  // An explicit fragment prevents the browser inheriting provider error fragments.
  return `/sign-in?authError=${error}#auth-link`;
}

type Notice = { mode: "sign-in" | "recover"; message: string; isError: boolean };

export function readSignInNotice(params: URLSearchParams): Notice | null {
  if (params.has("authError")) {
    const kind = params.getAll("authError").length === 1 ? params.get("authError") : null;
    if (kind === "recovery") {
      return {
        mode: "recover",
        message:
          "This password reset link may be expired or already used. Request a new password reset email below.",
        isError: true,
      };
    }
    return {
      mode: "sign-in",
      message:
        "This email link may be expired, already used, or opened in a different browser. If your email is already verified, sign in below. Otherwise, request a new verification email.",
      isError: true,
    };
  }
  if (params.has("passwordChanged")) {
    return {
      mode: "sign-in",
      message: "Password updated. Sign in with your new password.",
      isError: false,
    };
  }
  if (params.has("accountDeleted")) {
    return { mode: "sign-in", message: "Account deleted.", isError: false };
  }
  if (params.getAll("mode").length === 1 && params.get("mode") === "recover") {
    return { mode: "recover", message: "", isError: false };
  }
  return null;
}
