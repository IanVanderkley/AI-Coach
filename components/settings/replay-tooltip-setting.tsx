"use client";
import { useReplayTooltips } from "@/lib/settings/replay-tooltips";
import { useReplayView, isReplayView } from "@/lib/settings/replay-view";
import { useHistoryGrades } from "@/lib/settings/history-grades";
export function ReplayTooltipSetting() {
  const grades = useHistoryGrades();
  const { enabled, update } = useReplayTooltips();
  const { view, update: updateView } = useReplayView();
  return (
    <section className="coach-tooltip-settings" aria-label="Interface preferences">
      <h2>Coaching interface preferences</h2>
      <label className="coach-tooltip-option">
        <input
          type="checkbox"
          checked={grades.enabled}
          disabled={!grades.ready || grades.saving}
          onChange={(event) => void grades.update(event.target.checked)}
        />
        <span>
          <strong>Show game grades automatically</strong>
          <span>
            Show grades in Coaching history before opening a report. Turn off to reveal
            grades only after reviewing a game. Saved to your account when signed in.
          </span>
        </span>
      </label>
      {grades.error && <p role="alert">{grades.error}</p>}
      <label className="coach-replay-view-setting">
        <span>
          <strong>Default replay view</strong>
          <span>Choose how a new review opens. Saved automatically in this browser.</span>
        </span>
        <select
          value={view}
          onChange={(event) => {
            if (isReplayView(event.target.value)) updateView(event.target.value);
          }}
        >
          <option value="compare">Compare (before and after)</option>
          <option value="before">Before move</option>
          <option value="after">After move</option>
        </select>
      </label>
      <label className="coach-tooltip-option">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => update(event.target.checked)}
        />
        <span>
          <strong>Replay tooltips</strong>
          <span>
            Show helpful descriptions after hovering over Coaching replay controls. Saved
            automatically in this browser.
          </span>
        </span>
      </label>
    </section>
  );
}
