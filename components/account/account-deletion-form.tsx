"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AccountDeletionForm({ email }: { email: string }) {
  const router = useRouter();
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const locked = useRef(false);
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const invalidDialog = useRef<HTMLDialogElement>(null);
  const resendButton = useRef<HTMLButtonElement>(null);
  const [codeError, setCodeError] = useState<"incorrect" | "unavailable" | null>(null);
  useEffect(() => {
    if (codeError && !invalidDialog.current?.open) invalidDialog.current?.showModal();
  }, [codeError]);
  function dismissCodeError() {
    const retry = codeError === "incorrect";
    setCodeError(null);
    if (retry) codeInput.current?.focus();
    else resendButton.current?.focus();
  }
  useEffect(() => {
    if (challengeId) codeInput.current?.focus();
  }, [challengeId]);
  async function send(body: Record<string, string>) {
    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        typeof result.error === "string"
          ? result.error
          : "Could not complete the request.",
      );
    return result;
  }
  async function run(task: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage("");
    try {
      await task();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not complete the request. Try again.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get("password") ?? "");
    const confirmation = String(values.get("confirmation") ?? "");
    form.reset();
    void run(async () => {
      const result = await send({ action: "issue", password, confirmation });
      if (typeof result.challengeId !== "string")
        throw new Error("Could not start verification.");
      setCode("");
      setChallengeId(result.challengeId);
    });
  }
  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challengeId || !/^\d{6}$/.test(code)) return;
    void run(async () => {
      const result = await send({ action: "delete", challengeId, code }).catch(
        (error: unknown) => {
          if (
            error instanceof Error &&
            error.message === "Incorrect verification code."
          ) {
            setCode("");
            setCodeError("incorrect");
            return null;
          }
          if (
            error instanceof Error &&
            error.message ===
              "Verification code is invalid, expired or locked. Request a new code."
          ) {
            setCode("");
            setCodeError("unavailable");
            return null;
          }
          throw error;
        },
      );
      if (result === null) return;
      if (result.deleted !== true) throw new Error("Could not delete account.");
      setCode("");
      await getSupabaseBrowserClient()
        ?.auth.signOut({ scope: "local" })
        .catch(() => {});
      router.replace("/sign-in?accountDeleted=1");
      router.refresh();
    });
  }
  function cancel(restart: boolean) {
    if (!challengeId) return;
    void run(async () => {
      await send({ action: "cancel", challengeId });
      setChallengeId(null);
      setCode("");
      setMessage(
        restart
          ? "Enter your password to request a fresh code. The resend cooldown still applies."
          : "Account deletion cancelled.",
      );
    });
  }
  return (
    <div>
      {!challengeId ? (
        <form onSubmit={requestCode}>
          <label>
            Current password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={1024}
            />
          </label>
          <label>
            Type DELETE to confirm
            <input name="confirmation" autoComplete="off" required pattern="DELETE" />
          </label>
          <button className="auth-submit" disabled={busy}>
            Send verification code
          </button>
        </form>
      ) : (
        <section
          aria-labelledby="deletion-code-title"
          style={{
            width: "100%",
            maxWidth: 440,
            boxSizing: "border-box",
            margin: "16px auto",
            padding: 24,
            border: "1px solid #713038",
            borderRadius: 12,
            background: "#171717",
            color: "#f5f5f5",
            textAlign: "center",
          }}
        >
          <h3 id="deletion-code-title" style={{ fontSize: 22, marginBottom: 10 }}>
            Verify account deletion
          </h3>
          <p>Enter the six-digit code sent to {email}.</p>
          <form
            onSubmit={submitCode}
            style={{
              display: "grid",
              gap: 12,
              alignItems: "stretch",
              justifyItems: "stretch",
              margin: "16px 0 12px",
            }}
          >
            <label htmlFor="deletion-code" style={{ margin: 0, textAlign: "center" }}>
              Verification code
            </label>
            <div style={{ position: "relative", width: "100%" }}>
              <div
                aria-hidden="true"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                  gap: 6,
                }}
              >
                {Array.from({ length: 6 }, (_, index) => (
                  <span
                    key={index}
                    style={{
                      display: "grid",
                      placeItems: "center",
                      minHeight: 46,
                      border: `1px solid ${focused && index === Math.min(code.length, 5) ? "#e94350" : "#555"}`,
                      borderRadius: 6,
                      background: "#101010",
                      fontSize: 22,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {code[index] || "–"}
                  </span>
                ))}
              </div>
              <input
                id="deletion-code"
                ref={codeInput}
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                required
                value={code}
                disabled={busy}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onChange={(event) =>
                  setCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))
                }
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  opacity: 0,
                  cursor: "text",
                }}
              />
            </div>
            <p style={{ fontSize: 13, margin: "4px 0 8px", lineHeight: 1.5 }}>
              The code expires in 10 minutes. This action permanently deletes your
              account.
            </p>
            <button
              className="auth-submit"
              style={{
                width: "100%",
                maxWidth: "none",
                alignSelf: "stretch",
                justifySelf: "stretch",
                margin: 0,
                boxSizing: "border-box",
                minHeight: 44,
                whiteSpace: "normal",
              }}
              disabled={busy || code.length !== 6}
            >
              Verify code and permanently delete account
            </button>
          </form>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
              gap: 8,
            }}
          >
            <button
              ref={resendButton}
              className="settings-button"
              type="button"
              style={{ width: "100%", minHeight: 42, margin: 0, whiteSpace: "normal" }}
              disabled={busy}
              onClick={() => cancel(true)}
            >
              Request a new code
            </button>
            <button
              className="settings-button"
              type="button"
              style={{ width: "100%", minHeight: 42, margin: 0, whiteSpace: "normal" }}
              disabled={busy}
              onClick={() => cancel(false)}
            >
              Cancel account deletion
            </button>
          </div>
          {message && (
            <p role="alert" style={{ margin: "12px 0 0" }}>
              {message}
            </p>
          )}
          <dialog
            ref={invalidDialog}
            aria-labelledby="invalid-deletion-code-title"
            aria-describedby="invalid-deletion-code-description"
            onClose={dismissCodeError}
            className="backdrop:bg-black/70"
            style={{
              margin: "auto",
              width: "min(380px, calc(100% - 32px))",
              boxSizing: "border-box",
              padding: 24,
              border: "1px solid #713038",
              borderRadius: 12,
              background: "#171717",
              color: "#f5f5f5",
              textAlign: "center",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                display: "grid",
                placeItems: "center",
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#351c20",
                color: "#ff6670",
                fontSize: 28,
                fontWeight: 700,
                margin: "0 auto 16px",
              }}
            >
              !
            </div>
            <h3
              id="invalid-deletion-code-title"
              style={{ fontSize: 22, margin: "0 0 12px" }}
            >
              {codeError === "incorrect"
                ? "Invalid verification code"
                : "Verification code unavailable"}
            </h3>
            <p
              id="invalid-deletion-code-description"
              style={{ margin: "0 0 20px", lineHeight: 1.5 }}
            >
              {codeError === "incorrect"
                ? "That code is incorrect. Check your email and try again. Your account has not been deleted."
                : "This code is invalid, expired or locked. Request a new code to continue. Your account has not been deleted."}
            </p>
            <button
              type="button"
              className="auth-submit"
              style={{ width: "100%", maxWidth: "none", margin: 0, minHeight: 44 }}
              onClick={() => invalidDialog.current?.close()}
            >
              {codeError === "incorrect" ? "Try again" : "Close"}
            </button>
          </dialog>
        </section>
      )}
      {!challengeId && message && <p role="status">{message}</p>}
    </div>
  );
}
