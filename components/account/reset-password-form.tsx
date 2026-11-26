"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { authError, passwordProblem } from "@/lib/account/validation";
import { readRecoveryToken } from "@/lib/account/recovery-link";

export function ResetPasswordForm() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("Checking recovery link…");

  useEffect(() => {
    // A GET or email-link preview must never verify/consume the token.
    const fragment = window.location.hash;
    const value = readRecoveryToken(fragment);
    if (value) {
      setToken(value);
      setMessage("");
    } else {
      setMessage((previous) =>
        previous === "Checking recovery link…"
          ? "No valid recovery link was found. Request a new password reset email."
          : previous,
      );
    }
    if (fragment) {
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, []);

  async function confirmRecovery() {
    if (!token || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("Accounts unavailable");
      // Only an explicit click reaches this call. Never run it in an effect.
      const { data, error } = await client.auth.verifyOtp({
        token_hash: token,
        type: "recovery",
      });
      if (error || !data.session || !data.user) {
        setToken(null);
        setMessage("This recovery link is invalid or has expired. Request a new email.");
        return;
      }
      setToken(null);
      const verified = await client.auth.getUser();
      if (verified.error || verified.data.user?.id !== data.user.id) {
        setMessage("Could not verify your recovery session. Request a new email.");
        return;
      }
      setVerifiedUserId(data.user.id);
      setVerifiedEmail(verified.data.user.email ?? "");
    } catch {
      setMessage(
        "Could not verify your recovery link. Try again or request a new email.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !verifiedUserId) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const problem = passwordProblem(password, String(form.get("confirm") ?? ""));
    if (problem) {
      setMessage(problem);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("Accounts unavailable");
      // Do not update a different account if the browser session changed.
      const verified = await client.auth.getUser();
      if (verified.error || verified.data.user?.id !== verifiedUserId) {
        setVerifiedUserId(null);
        setVerifiedEmail("");
        setMessage("Your recovery session changed. Request a new password reset email.");
        return;
      }
      const { error } = await client.auth.updateUser({ password });
      if (error) {
        setMessage(authError(error));
        return;
      }
      setVerifiedUserId(null);
      setVerifiedEmail("");
      const logout = await client.auth.signOut({ scope: "global" });
      if (logout.error) {
        setMessage("Password changed. Sign out from Settings before signing in again.");
        return;
      }
      router.replace("/sign-in?passwordChanged=1");
      router.refresh();
    } catch {
      setMessage(
        "Could not complete password recovery. Try signing in or request a new link.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {token && !verifiedUserId && (
        <div className="auth-form">
          <p className="auth-intro">
            Continue to verify this single-use recovery link. You will then be able to
            choose a new password.
          </p>
          <button
            className="auth-submit"
            type="button"
            disabled={busy}
            onClick={() => void confirmRecovery()}
          >
            {busy ? "Verifying…" : "Continue to reset password"}
          </button>
        </div>
      )}
      {verifiedUserId && (
        <>
          <p className="auth-intro">
            {verifiedEmail ? `Resetting the password for ${verifiedEmail}. ` : ""}
            Use at least eight characters and choose a password you do not use elsewhere.
          </p>
          <form className="auth-form" onSubmit={submit}>
            <label className="field-group">
              <span>New password</span>
              <span className="input-shell password-shell">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
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
            </label>
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        </>
      )}
      {message && (
        <p className="auth-message" role="status">
          {message}
        </p>
      )}
      {!token && !verifiedUserId && !busy && message !== "Checking recovery link…" && (
        <div className="account-auth-links">
          <Link href="/sign-in?mode=recover">Request a new password reset email</Link>
        </div>
      )}
    </>
  );
}
