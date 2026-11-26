"use client";

import { useEffect, useState } from "react";

export function LeaderboardPrivacy() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [guest, setGuest] = useState(false);
  const [available, setAvailable] = useState(false);
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
        const data = await response.json();
        if (typeof data?.isAnonymous !== "boolean" || typeof data?.rating !== "number")
          throw new Error("Invalid preferences");
        if (!controller.signal.aborted) {
          setIsAnonymous(data.isAnonymous);
          setRating(data.rating);
          setAvailable(true);
        }
      } catch {
        if (!controller.signal.aborted) {
          setMessage(
            "Leaderboard privacy settings are currently unavailable. Refresh to retry.",
          );
          setIsError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  async function save() {
    if (saving || !available) return;
    setSaving(true);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/leaderboard/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ isAnonymous }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(typeof result?.error === "string" ? result.error : "Save failed");
      if (typeof result?.isAnonymous !== "boolean")
        throw new Error("Invalid server response");
      setIsAnonymous(result.isAnonymous);
      setMessage(
        result.isAnonymous
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
        username and results. Change your username under Account settings. Your private
        match history and XP are never affected.
      </p>
      {loading ? (
        <p role="status">Loading visibility settings…</p>
      ) : guest ? (
        <p role="status">Sign in to change your leaderboard visibility.</p>
      ) : (
        available && (
          <div className="leaderboard-privacy-controls">
            <label className="leaderboard-privacy-check">
              <input
                type="checkbox"
                checked={isAnonymous}
                disabled={saving}
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
                Your saved Ranked Elo: <strong>{rating.toLocaleString()}</strong>
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
          </div>
        )
      )}
      {message && (
        <p
          role={isError ? "alert" : "status"}
          className={isError ? "leaderboard-privacy-error" : "leaderboard-privacy-saved"}
        >
          {message}
        </p>
      )}
    </section>
  );
}
