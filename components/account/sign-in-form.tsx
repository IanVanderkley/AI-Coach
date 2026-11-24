"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  authError,
  validEmail,
  validUsername,
  passwordProblem,
  confirmationMessage,
} from "@/lib/account/validation";
export function SignInForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "create" | "recover" | "resend">(
    "sign-in",
  );
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("passwordChanged"))
      setMessage("Password updated. Sign in with your new password.");
    else if (params.has("accountDeleted")) setMessage("Account deleted.");
    else if (params.has("authError")) {
      setIsError(true);
      setMessage(
        "This email link could not be verified. Request a new link and open it in the browser where you requested it.",
      );
    }
  }, []);
  function switchMode(next: typeof mode) {
    setMode(next);
    setMessage("");
    setIsError(false);
    setShowPassword(false);
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const form = new FormData(event.currentTarget);
    const address = email.trim();
    const password = String(form.get("password") ?? "");
    const username = String(form.get("username") ?? "").trim();
    setMessage("");
    setIsError(false);
    setLoading(true);
    try {
      const client = getSupabaseBrowserClient();
      if (!client) {
        setMessage("Accounts are temporarily unavailable.");
        setIsError(true);
        return;
      }
      if (!validEmail(address)) {
        setMessage("Enter a valid email address.");
        setIsError(true);
        return;
      }
      const callback = window.location.origin + "/auth/callback";
      if (mode === "recover" || mode === "resend") {
        const response =
          mode === "recover"
            ? await client.auth.resetPasswordForEmail(address, {
                redirectTo: callback + "?kind=recovery",
              })
            : await client.auth.resend({
                type: "signup",
                email: address,
                options: { emailRedirectTo: callback + "?kind=signup" },
              });
        // Do not expose whether an email address has a registered account.
        if (
          response.error &&
          ["over_email_send_rate_limit", "over_request_rate_limit"].includes(
            response.error.code ?? "",
          )
        ) {
          setMessage(authError(response.error));
          setIsError(true);
        } else if (response.error && (response.error.status ?? 0) >= 500) {
          setMessage("Email delivery is temporarily unavailable. Try again later.");
          setIsError(true);
        } else
          setMessage(
            mode === "recover"
              ? confirmationMessage("recovery")
              : "If confirmation is needed, a new email will be sent. Check your inbox and spam folder.",
          );
        return;
      }
      if (mode === "create") {
        const problem = !validUsername(username)
          ? "Use 3–20 letters, numbers or underscores for your username."
          : passwordProblem(password, String(form.get("confirm") ?? ""));
        if (problem) {
          setMessage(problem);
          setIsError(true);
          return;
        }
        const { data, error } = await client.auth.signUp({
          email: address,
          password,
          options: { data: { username }, emailRedirectTo: callback + "?kind=signup" },
        });
        if (error) {
          setMessage(
            error.code === "user_already_exists" || error.code === "email_exists"
              ? confirmationMessage("signup")
              : authError(error),
          );
          setIsError(
            error.code !== "user_already_exists" && error.code !== "email_exists",
          );
          return;
        }
        if (!data.session) {
          setMessage(confirmationMessage("signup"));
          setMode("sign-in");
          return;
        }
      } else {
        const { error } = await client.auth.signInWithPassword({
          email: address,
          password,
        });
        if (error) {
          setMessage(authError(error));
          setIsError(true);
          return;
        }
      }
      router.push("/profile");
      router.refresh();
    } catch {
      setMessage("Could not connect. Check your connection and try again.");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }
  const emailOnly = mode === "recover" || mode === "resend";
  return (
    <section className="auth-card" aria-labelledby="auth-heading">
      <div className="auth-tabs" aria-label="Account options">
        <button
          type="button"
          className={mode === "sign-in" ? "auth-tab active" : "auth-tab"}
          disabled={loading}
          onClick={() => switchMode("sign-in")}
        >
          Sign In
        </button>
        <button
          type="button"
          className={mode === "create" ? "auth-tab active" : "auth-tab"}
          disabled={loading}
          onClick={() => switchMode("create")}
        >
          Create Account
        </button>
      </div>
      <div className="auth-card-content">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1 id="auth-heading">
          {mode === "recover"
            ? "Reset your password."
            : mode === "resend"
              ? "Verify your email."
              : mode === "create"
                ? "Start improving."
                : "Welcome back."}
        </h1>
        <p className="auth-intro">
          {emailOnly
            ? "Enter your email to request a secure link."
            : "Sign in to keep your Practice history, Ranked results and coaching preferences with your account."}
        </p>
        <form key={mode} className="auth-form" onSubmit={handleSubmit}>
          {mode === "create" && (
            <label className="field-group">
              <span>Username</span>
              <span className="input-shell">
                <UserRound size={18} aria-hidden="true" />
                <input
                  name="username"
                  autoComplete="username"
                  minLength={3}
                  maxLength={20}
                  pattern="[A-Za-z0-9_]{3,20}"
                  required
                />
              </span>
            </label>
          )}
          <label className="field-group">
            <span>Email</span>
            <span className="input-shell">
              <Mail size={18} aria-hidden="true" />
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </span>
          </label>
          {!emailOnly && (
            <label className="field-group">
              <span>Password</span>
              <span className="input-shell password-shell">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  minLength={mode === "create" ? 8 : undefined}
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
          )}
          {mode === "create" && (
            <label className="field-group">
              <span>Confirm password</span>
              <span className="input-shell">
                <input
                  name="confirm"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </span>
              <small>At least 8 characters.</small>
            </label>
          )}
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading
              ? "Please wait…"
              : mode === "recover"
                ? "Send reset link"
                : mode === "resend"
                  ? "Resend verification"
                  : mode === "create"
                    ? "Create Account"
                    : "Sign In"}
          </button>
        </form>
        <div className="account-auth-links">
          {mode !== "recover" && (
            <button
              type="button"
              disabled={loading}
              onClick={() => switchMode("recover")}
            >
              Forgot password?
            </button>
          )}
          {mode !== "resend" && (
            <button type="button" disabled={loading} onClick={() => switchMode("resend")}>
              Resend verification email
            </button>
          )}
          {emailOnly && (
            <button
              type="button"
              disabled={loading}
              onClick={() => switchMode("sign-in")}
            >
              Back to sign in
            </button>
          )}
        </div>
        {message && (
          <p
            className={`auth-message${isError ? " error" : ""}`}
            role={isError ? "alert" : "status"}
          >
            {message}
          </p>
        )}
        <p className="auth-footnote">
          Your account is securely handled through Supabase authentication.
        </p>
      </div>
    </section>
  );
}
