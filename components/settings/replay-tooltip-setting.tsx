"use client";
import { useReplayTooltips } from "@/lib/settings/replay-tooltips";
import { useReplayView, isReplayView } from "@/lib/settings/replay-view";
import { useCoachingSections } from "@/lib/settings/coaching-sections";
import {
  COACHING_SECTION_LABELS,
  type CoachingSection,
} from "@/lib/settings/coaching-section-preferences";
import { useHistoryGrades } from "@/lib/settings/history-grades";
export function ReplayTooltipSetting() {
  const grades = useHistoryGrades();
  const defaults = useCoachingSections();
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
            Show helpful descriptions after a short hover or keyboard focus on Coaching
            replay controls and board cells. Saved automatically in this browser.
          </span>
        </span>
      </label>
      <div className="coach-section-default-settings">
        <h3>Open Coaching sections by default</h3>
        <p>
          Choose which sections start expanded. Saved in this browser; you can still open
          or close each card during a review.
        </p>
        {(Object.keys(COACHING_SECTION_LABELS) as CoachingSection[])
          .filter((key) => key !== "samples" && key !== "accuracy" && key !== "score")
          .map((key) => (
            <label className="coach-tooltip-option" key={key}>
              <input
                type="checkbox"
                checked={defaults.sections[key]}
                disabled={!defaults.ready}
                onChange={(event) => defaults.update(key, event.target.checked)}
              />
              <span>
                <strong>{COACHING_SECTION_LABELS[key]}</strong>
              </span>
            </label>
          ))}
        {defaults.error && <p role="alert">{defaults.error}</p>}
      </div>
    </section>
  );
}
