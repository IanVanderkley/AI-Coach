"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { authError, validEmail } from "@/lib/account/validation";
import { AccountDeletionForm } from "./account-deletion-form";
import {
  EMAIL_UNAVAILABLE_MESSAGE,
  isEmailUnavailable,
} from "@/lib/account/email-change-feedback";
export function AccountManagement({ deletionEnabled }: { deletionEnabled: boolean }) {
  const router = useRouter();
  const emailDialog = useRef<HTMLDialogElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    const client = getSupabaseBrowserClient();
    if (!client) {
      setReady(true);
      return;
    }
    void client.auth
      .getUser()
      .then(({ data }) => {
        if (active) {
          setUser(data.user);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setReady(true);
          setMessage("Could not verify your account. Refresh to retry.");
        }
      });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  async function run(action: () => Promise<string>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      setMessage(await action());
    } catch {
      setMessage("Could not complete the request. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!validEmail(email)) {
      setMessage("Enter a valid new email.");
      return;
    }
    void run(async () => {
      const client = getSupabaseBrowserClient();
      if (!client) throw Error();
      const { error } = await client.auth.updateUser(
        { email },
        { emailRedirectTo: window.location.origin + "/auth/callback?kind=email" },
      );
      if (isEmailUnavailable(error)) {
        if (!emailDialog.current?.open) emailDialog.current?.showModal();
        return EMAIL_UNAVAILABLE_MESSAGE;
      }
      return error
        ? authError(error)
        : "Check both your current and new email addresses for confirmation instructions. Your current email stays active until both confirmations are complete.";
    });
  }
  function resetPassword() {
    void run(async () => {
      const client = getSupabaseBrowserClient();
      if (!client || !user?.email) throw Error();
      const { error } = await client.auth.resetPasswordForEmail(user.email, {
        redirectTo: window.location.origin + "/reset-password",
      });
      return error ? authError(error) : "Check your inbox for the password reset link.";
    });
  }
  function signOutAll() {
    void run(async () => {
      const client = getSupabaseBrowserClient();
      if (!client) throw Error();
      const { error } = await client.auth.signOut({ scope: "global" });
      if (error) return authError(error);
      router.replace("/sign-in");
      router.refresh();
      return "Signed out of all devices.";
    });
  }
  return (
    <section className="account-management" aria-labelledby="account-management-title">
      <h2 id="account-management-title">Account management</h2>
      {!ready ? (
        <p>Checking account…</p>
      ) : !user ? (
        <p>
          <Link href="/sign-in">Sign in</Link> to manage your account.
        </p>
      ) : (
        <>
          <p>
            Signed in as <strong>{user.email}</strong> ·{" "}
            {user.email_confirmed_at ? "Email verified" : "Email not verified"}
          </p>
          <details>
            <summary>Change email address</summary>
            <form onSubmit={changeEmail}>
              <label>
                New email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </label>
              <button className="auth-submit" disabled={busy}>
                Send confirmation
              </button>
            </form>
          </details>
          <details>
            <summary>Change password</summary>
            <p>Send a secure link to your current email address.</p>
            <button
              className="auth-submit"
              type="button"
              disabled={busy}
              onClick={resetPassword}
            >
              Send password reset link
            </button>
          </details>
          <details>
            <summary>Sign out of all devices</summary>
            <p>This ends other active account sessions as well as this one.</p>
            <button
              className="auth-submit"
              type="button"
              disabled={busy}
              onClick={signOutAll}
            >
              Sign out everywhere
            </button>
          </details>
          <details>
            <summary>Delete account</summary>
            <p>
              This permanently deletes your account and associated saved game history,
              Ranked results, leaderboard profile, XP and coaching settings. This cannot
              be undone.
            </p>
            {deletionEnabled ? (
              <AccountDeletionForm
                key={`${user.id}:${user.email}`}
                email={user.email ?? ""}
              />
            ) : (
              <p>
                Self-service deletion is not enabled until staging verification is
                complete. Contact the project administrator for deletion requests.
              </p>
            )}
          </details>
        </>
      )}
      {message && <p role="status">{message}</p>}
      <dialog
        ref={emailDialog}
        aria-labelledby="email-unavailable-title"
        aria-describedby="email-unavailable-description"
        className="backdrop:bg-black/70"
        style={{
          margin: "auto",
          width: "min(420px, calc(100% - 32px))",
          padding: 24,
          borderRadius: 10,
          border: "1px solid #713038",
          background: "#171717",
          color: "#f5f5f5",
        }}
      >
        <h2 id="email-unavailable-title" style={{ fontSize: 24, marginBottom: 12 }}>
          Email unavailable
        </h2>
        <p id="email-unavailable-description">{EMAIL_UNAVAILABLE_MESSAGE}</p>
        <button
          className="settings-button settings-button-primary"
          type="button"
          style={{ marginTop: 20, width: "100%" }}
          onClick={() => emailDialog.current?.close()}
        >
          Try another email
        </button>
      </dialog>
    </section>
  );
}
