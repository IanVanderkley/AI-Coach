"use client";

import { useState } from "react";
import { useBoardGuide } from "@/lib/settings/board-guide";

export function BoardGuideSetting() {
  const { enabled, update } = useBoardGuide();
  const [error, setError] = useState("");
  return (
    <section className="coach-tooltip-settings" aria-label="Gameplay interface preferences">
      <h2>Gameplay interface</h2>
      <label className="coach-tooltip-option">
        <input type="checkbox" checked={enabled} onChange={(event) => {
          setError(update(event.target.checked) ? "" : "Could not save this preference. Check your browser storage settings and try again.");
        }} />
        <span>
          <strong>Show board controls guide</strong>
          <span>Show the Reveal, Flag and Chord reference beneath Practice and Ranked boards, including the Ranked clock reminder. Turn off for a cleaner play area. Saved automatically in this browser.</span>
        </span>
      </label>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
