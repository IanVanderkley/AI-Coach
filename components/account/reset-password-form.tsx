"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { authError, passwordProblem } from "@/lib/account/validation";
export function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Verifying your session…");
  useEffect(() => {
    let active = true;
    const client = getSupabaseBrowserClient();
    if (!client) {
      setMessage("Accounts are unavailable.");
      return;
    }
    void client.auth
      .getUser()
      .then(({ data, error }) => {
        if (active) {
          setReady(Boolean(data.user && !error));
          setMessage(
            data.user && !error
              ? ""
              : "Your session is unavailable. Request a new password reset link.",
          );
        }
      })
      .catch(() => {
        if (active) setMessage("Could not verify your session.");
      });
    return () => {
      active = false;
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !ready) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const problem = passwordProblem(password, String(form.get("confirm") ?? ""));
    if (problem) {
      setMessage(problem);
      return;
    }
    setBusy(true);
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw Error();
      const { error } = await client.auth.updateUser({ password });
      if (error) {
        setMessage(authError(error));
        return;
      }
      const logout = await client.auth.signOut({ scope: "global" });
      if (logout.error) {
        setReady(false);
        setMessage("Password changed. Sign out from Settings before signing in again.");
        return;
      }
      router.replace("/sign-in?passwordChanged=1");
      router.refresh();
    } catch {
      setMessage("Could not update your password. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {ready && (
        <form onSubmit={submit}>
          <label>
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label>
            Confirm password
            <input
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </>
  );
}
