"use client";
import { useEffect, useState, type FormEvent } from "react";
import { validUsername } from "@/lib/account/validation";
import { usernameContentProblem } from "@/lib/account/username-moderation";

type Identity = { username: string; nextChangeAt: string | null };
function parseIdentity(value: unknown): Identity {
  if (!value || typeof value !== "object") throw new Error("Invalid response");
  const data = value as Record<string, unknown>;
  if (
    typeof data.username !== "string" ||
    !validUsername(data.username) ||
    (data.nextChangeAt !== null &&
      (typeof data.nextChangeAt !== "string" ||
        !Number.isFinite(Date.parse(data.nextChangeAt))))
  )
    throw new Error("Invalid response");
  return { username: data.username, nextChangeAt: data.nextChangeAt };
}

export function UsernameSetting() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void (async () => {
      try {
        const response = await fetch("/api/leaderboard/preferences", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error("Account username unavailable. Refresh to retry.");
        const data = parseIdentity(await response.json());
        if (!controller.signal.aborted) {
          setIdentity(data);
          setDraft(data.username);
        }
      } catch {
        if (!controller.signal.aborted) {
          setIdentity(null);
          setError(true);
          setMessage("Could not load your username.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [revision]);

  const locked =
    identity?.nextChangeAt != null && Date.parse(identity.nextChangeAt) > Date.now();
  const contentProblem = usernameContentProblem(draft.trim());
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = draft.trim();
    if (
      !identity ||
      locked ||
      saving ||
      username === identity.username ||
      !validUsername(username)
    )
      return;
    const problem = usernameContentProblem(username);
    if (problem) {
      setError(true);
      setMessage(problem);
      return;
    }
    setSaving(true);
    setMessage("");
    setError(false);
    try {
      const response = await fetch("/api/leaderboard/preferences", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data?.error === "string" ? data.error : "Could not save username.",
        );
      const saved = parseIdentity(data);
      setIdentity(saved);
      setDraft(saved.username);
      window.dispatchEvent(new Event("ai-coach:username-updated"));
      setMessage("Username updated. Your XP, Ranked rating and privacy are unchanged.");
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : "Could not save username.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <details>
      <summary>Change username{identity ? ` · ${identity.username}` : ""}</summary>
      <p>
        Use 3–20 letters, numbers or underscores. Profanity, slurs and hateful language
        are not allowed. Your first change is available immediately; subsequent changes
        are limited to once every 30 days. Your username appears on eligible public
        leaderboards unless Anonymous mode is enabled.
      </p>
      {loading ? (
        <p role="status">Loading username…</p>
      ) : identity ? (
        <form onSubmit={save}>
          <label>
            Username
            <input
              name="username"
              autoComplete="username"
              required
              minLength={3}
              maxLength={20}
              pattern="[A-Za-z0-9_]{3,20}"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={saving || locked}
            />
          </label>
          {contentProblem && <p role="alert">{contentProblem}</p>}
          {locked && identity.nextChangeAt && (
            <p>
              Next change available: {new Date(identity.nextChangeAt).toLocaleString()}
            </p>
          )}
          <button
            className="auth-submit"
            disabled={
              saving ||
              locked ||
              draft.trim() === identity.username ||
              !validUsername(draft.trim()) ||
              contentProblem !== null
            }
          >
            {saving ? "Saving…" : "Save username"}
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="auth-submit"
          onClick={() => {
            setMessage("");
            setError(false);
            setRevision((v) => v + 1);
          }}
        >
          Retry
        </button>
      )}
      {message && <p role={error ? "alert" : "status"}>{message}</p>}
    </details>
  );
}
