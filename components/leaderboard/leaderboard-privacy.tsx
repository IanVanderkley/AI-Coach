"use client";

import { useEffect, useState } from "react";

export function LeaderboardPrivacy() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [guest, setGuest] = useState(false);
  const [username, setUsername] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/leaderboard/preferences", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          if (!controller.signal.aborted) setGuest(true);
          return;
        }
        if (!response.ok) throw new Error("Preferences unavailable");
        const value: unknown = await response.json();
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          throw new Error("Invalid preferences");
        }
        const data = value as Record<string, unknown>;
        if (
          typeof data.username !== "string" ||
          typeof data.isAnonymous !== "boolean" ||
          typeof data.rating !== "number"
        ) {
          throw new Error("Invalid preferences");
        }
        if (!controller.signal.aborted) {
          setUsername(data.username);
          setIsAnonymous(data.isAnonymous);
          setRating(data.rating);
        }
      } catch {
        if (!controller.signal.aborted) {
          setMessage("Leaderboard privacy settings are currently unavailable.");
          setIsError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  async function save() {
    if (saving) return;
    setSaving(true);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/leaderboard/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username: username.trim(), isAnonymous }),
      });
      const value: unknown = await response.json();
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Invalid server response");
      }
      const result = value as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(typeof result.error === "string" ? result.error : "Save failed");
      }
      setUsername(result.username as string);
      setMessage(
        isAnonymous
          ? "Saved. Your username and results are hidden from public leaderboards."
          : "Saved. Your username and eligible results are public.",
      );
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="leaderboard-privacy" aria-labelledby="leaderboard-privacy-title">
      <p className="eyebrow">RANKED PRIVACY</p>
      <h2 id="leaderboard-privacy-title">Leaderboard visibility</h2>
      <p>
        New Ranked players appear publicly by default. Turn on Anonymous mode to hide your
        username and results. Your private match history and XP are never affected.
      </p>
      {loading ? (
        <p role="status">Loading visibility settings…</p>
      ) : guest ? (
        <p role="status">Sign in to change your leaderboard visibility.</p>
      ) : (
        <div className="leaderboard-privacy-controls">
          <label className="leaderboard-privacy-name">
            <span>Public username</span>
            <input
              type="text"
              maxLength={20}
              autoComplete="off"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="YourUsername"
              aria-describedby="leaderboard-name-help"
            />
          </label>
          <p id="leaderboard-name-help" className="leaderboard-privacy-help">
            3–20 letters, numbers, or underscores. Displayed publicly unless Anonymous
            mode is enabled.
          </p>
          <label className="leaderboard-privacy-check">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(event) => setIsAnonymous(event.target.checked)}
            />
            <span>
              <strong>Anonymous mode</strong>
              <small>
                Hide my username and all results from both public leaderboards.
              </small>
            </span>
          </label>
          {rating !== null && (
            <p className="leaderboard-privacy-rating">
              Your saved solo rating: <strong>{rating.toLocaleString()}</strong>
            </p>
          )}
          <button
            className="settings-button settings-button-primary"
            type="button"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save leaderboard visibility"}
          </button>
          {message && (
            <p
              role={isError ? "alert" : "status"}
              className={
                isError ? "leaderboard-privacy-error" : "leaderboard-privacy-saved"
              }
            >
              {message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
