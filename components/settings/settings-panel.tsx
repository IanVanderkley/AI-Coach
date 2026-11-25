"use client";

import { AlignLeft, MessageSquare, UserRound, type LucideIcon } from "lucide-react";

import { useSettingsPreferences } from "@/lib/settings/use-settings-preferences";
import type { ExperienceLevel, SettingsSection } from "@/lib/settings/types";

const coachingStyles = [
  {
    value: "encouraging",
    label: "Encouraging",
    description: "Supportive feedback that recognizes good decisions and progress.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "A mix of encouragement and direct, constructive feedback.",
  },
  {
    value: "direct",
    label: "Direct",
    description: "Candid feedback focused on the decision and the evidence.",
  },
] as const;

const explanationDetails = [
  {
    value: "brief",
    label: "Brief",
    description: "The key point and a practical next step.",
  },
  {
    value: "standard",
    label: "Standard",
    description:
      "What happened, why it mattered, and a stronger option when the evidence supports one.",
  },
  {
    value: "detailed",
    label: "Detailed",
    description:
      "A fuller walkthrough of the visible information, relevant logic or pattern, and possible next steps.",
  },
] as const;

const experienceLevels = [
  { value: "new", label: "New to Minesweeper" },
  { value: "some", label: "Some experience" },
  { value: "experienced", label: "Experienced" },
] as const;

const coachingGoals = [
  { value: "patterns", label: "Recognize board patterns" },
  { value: "logic", label: "Strengthen logical decisions" },
  { value: "guessing", label: "Avoid unnecessary guesses" },
  { value: "flagging", label: "Improve flagging accuracy" },
  { value: "efficiency", label: "Play more efficiently" },
] as const;

const competitivenessLevels = [
  {
    value: "relaxed",
    label: "Relaxed",
    description: "Keep the focus casual and low-pressure.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Balance improvement with a comfortable pace.",
  },
  {
    value: "competitive",
    label: "Competitive",
    description: "Emphasize challenge, consistency, and ranked goals.",
  },
] as const;

const settingsSections: Array<{
  id: SettingsSection;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: "coaching-style",
    title: "Coaching style",
    description: "Tone and voice",
    icon: MessageSquare,
  },
  {
    id: "explanation-detail",
    title: "Explanation detail",
    description: "How much detail",
    icon: AlignLeft,
  },
  {
    id: "player-profile",
    title: "Player profile",
    description: "Experience and goals",
    icon: UserRound,
  },
];

type SectionActionsProps = {
  hasChanges: boolean;
  isSaving: boolean;
  statusMessage: string;
  onSave: () => void;
  onReset: () => void;
};

function SectionActions({
  hasChanges,
  isSaving,
  statusMessage,
  onSave,
  onReset,
}: SectionActionsProps) {
  return (
    <div className="settings-section-actions">
      <p className="settings-actions-status" role="status" aria-live="polite">
        {statusMessage || (hasChanges ? "This section has unsaved changes." : "")}
      </p>
      <div className="settings-section-action-buttons">
        <button
          className="settings-button settings-button-quiet"
          type="button"
          onClick={onReset}
          disabled={isSaving}
        >
          Reset this section
        </button>
        <button
          className="settings-button settings-button-primary"
          type="button"
          onClick={onSave}
          disabled={!hasChanges || isSaving}
        >
          Save this section
        </button>
      </div>
    </div>
  );
}

export function SettingsPanel({ category }: { category: "coaching" | "player" }) {
  const {
    preferences,
    sectionMessages,
    globalMessage,
    isLoading,
    hasUnsavedChanges,
    hasSectionChanges,
    isSaving,
    updatePreference,
    toggleGoal,
    saveSection,
    saveAll,
    discardAll,
    resetSection,
    resetAll,
  } = useSettingsPreferences();

  function confirmResetAll() {
    const confirmed = window.confirm(
      "Reset coaching and player preferences to defaults? Save your preferences to keep the changes.",
    );
    if (!confirmed) return;
    resetAll();
  }

  function confirmResetSection(section: SettingsSection) {
    const sectionTitle = settingsSections.find((item) => item.id === section)?.title;
    const confirmed = window.confirm(
      `Reset ${sectionTitle} to its default values? You will need to save this section to keep the changes.`,
    );
    if (confirmed) resetSection(section);
  }

  if (isLoading) {
    return (
      <p className="settings-actions-status" role="status" aria-live="polite">
        Loading settings…
      </p>
    );
  }

  return (
    <>
      <div className="settings-actions settings-actions-top">
        <div className="settings-actions-copy">
          {(globalMessage || hasUnsavedChanges) && (
            <p className="settings-actions-status" role="status" aria-live="polite">
              {globalMessage || "You have unsaved coaching or player preferences."}
            </p>
          )}
        </div>
        <div className="settings-actions-buttons">
          <button
            className="settings-button settings-button-quiet"
            type="button"
            onClick={confirmResetAll}
            disabled={isSaving}
          >
            Reset preferences
          </button>
          <button
            className="settings-button settings-button-secondary"
            type="button"
            onClick={discardAll}
            disabled={!hasUnsavedChanges || isSaving}
          >
            Discard preference changes
          </button>
          <button
            className="settings-button settings-button-primary"
            type="button"
            onClick={saveAll}
            disabled={!hasUnsavedChanges || isSaving}
          >
            Save all preferences
          </button>
        </div>
      </div>

      <div className="settings-preference-layout">
        <div className="settings-content" id="settings-content">
          {category === "coaching" && (
            <section className="settings-section" aria-labelledby="coaching-style-title">
              <div className="settings-section-heading">
                <div>
                  <p className="settings-content-eyebrow">COACH PREFERENCES</p>
                  <h2 id="coaching-style-title">Coaching style</h2>
                  <p>
                    Choose the tone your coach should use in feedback and conversations.
                  </p>
                </div>
              </div>

              <fieldset className="settings-options">
                <legend className="sr-only">Choose a coaching style</legend>
                {coachingStyles.map((style) => (
                  <label
                    className={`settings-option${preferences.coachingStyle === style.value ? " selected" : ""}`}
                    key={style.value}
                  >
                    <input
                      type="radio"
                      name="coaching-style"
                      value={style.value}
                      checked={preferences.coachingStyle === style.value}
                      onChange={() => updatePreference("coachingStyle", style.value)}
                    />
                    <span className="settings-option-copy">
                      <span className="settings-option-title">{style.label}</span>
                      <span className="settings-option-description">
                        {style.description}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <p className="settings-note" role="status" aria-live="polite">
                Selected style:{" "}
                {
                  coachingStyles.find(
                    (style) => style.value === preferences.coachingStyle,
                  )?.label
                }
              </p>
              <SectionActions
                hasChanges={hasSectionChanges("coaching-style")}
                isSaving={isSaving}
                statusMessage={sectionMessages["coaching-style"]}
                onSave={() => saveSection("coaching-style")}
                onReset={() => confirmResetSection("coaching-style")}
              />
            </section>
          )}

          {category === "coaching" && (
            <section
              className="settings-section"
              aria-labelledby="explanation-detail-title"
            >
              <div className="settings-section-heading">
                <div>
                  <p className="settings-content-eyebrow">COACH PREFERENCES</p>
                  <h2 id="explanation-detail-title">Explanation detail</h2>
                  <p>Choose how much context your coach should usually include.</p>
                </div>
              </div>

              <fieldset className="settings-options">
                <legend className="sr-only">Choose an explanation detail level</legend>
                {explanationDetails.map((detail) => (
                  <label
                    className={`settings-option${preferences.explanationDetail === detail.value ? " selected" : ""}`}
                    key={detail.value}
                  >
                    <input
                      type="radio"
                      name="explanation-detail"
                      value={detail.value}
                      checked={preferences.explanationDetail === detail.value}
                      onChange={() => updatePreference("explanationDetail", detail.value)}
                    />
                    <span className="settings-option-copy">
                      <span className="settings-option-title">{detail.label}</span>
                      <span className="settings-option-description">
                        {detail.description}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <p className="settings-note" role="status" aria-live="polite">
                Selected detail:{" "}
                {
                  explanationDetails.find(
                    (detail) => detail.value === preferences.explanationDetail,
                  )?.label
                }
              </p>
              <SectionActions
                hasChanges={hasSectionChanges("explanation-detail")}
                isSaving={isSaving}
                statusMessage={sectionMessages["explanation-detail"]}
                onSave={() => saveSection("explanation-detail")}
                onReset={() => confirmResetSection("explanation-detail")}
              />
            </section>
          )}

          {category === "player" && (
            <section className="settings-section" aria-labelledby="player-profile-title">
              <div className="settings-section-heading">
                <div>
                  <p className="settings-content-eyebrow">YOUR COACHING PROFILE</p>
                  <h2 id="player-profile-title">Player profile</h2>
                  <p>
                    Share a little context so coaching can fit your experience and goals.
                    These preferences guide communication; they do not affect rank or game
                    analysis.
                  </p>
                </div>
              </div>

              <div className="settings-profile-grid">
                <div className="settings-field">
                  <label className="settings-field-label" htmlFor="experience-level">
                    Experience level
                  </label>
                  <select
                    className="settings-select"
                    id="experience-level"
                    name="experience-level"
                    value={preferences.experienceLevel}
                    onChange={(event) =>
                      updatePreference(
                        "experienceLevel",
                        event.target.value as ExperienceLevel,
                      )
                    }
                  >
                    {experienceLevels.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </div>

                <fieldset className="settings-field settings-competitiveness">
                  <legend className="settings-field-label">Competitiveness</legend>
                  <div className="settings-options">
                    {competitivenessLevels.map((level) => (
                      <label
                        className={`settings-option${preferences.competitiveness === level.value ? " selected" : ""}`}
                        key={level.value}
                      >
                        <input
                          type="radio"
                          name="competitiveness"
                          value={level.value}
                          checked={preferences.competitiveness === level.value}
                          onChange={() =>
                            updatePreference("competitiveness", level.value)
                          }
                        />
                        <span className="settings-option-copy">
                          <span className="settings-option-title">{level.label}</span>
                          <span className="settings-option-description">
                            {level.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>

              <fieldset className="settings-field settings-goals">
                <legend className="settings-field-label">Coaching goals</legend>
                <p className="settings-field-help">
                  Select any areas you would like the coach to keep in mind.
                </p>
                <div className="settings-goal-grid">
                  {coachingGoals.map((goal) => (
                    <label className="settings-goal-option" key={goal.value}>
                      <input
                        type="checkbox"
                        name="coaching-goals"
                        value={goal.value}
                        checked={preferences.selectedGoals.includes(goal.value)}
                        onChange={() => toggleGoal(goal.value)}
                      />
                      <span>{goal.label}</span>
                    </label>
                  ))}
                </div>

                <label className="settings-field-label" htmlFor="custom-goal">
                  Another goal (optional)
                </label>
                <input
                  className="settings-text-input"
                  id="custom-goal"
                  name="custom-goal"
                  type="text"
                  maxLength={160}
                  placeholder="Describe something else you want to improve"
                  value={preferences.customGoal}
                  onChange={(event) => updatePreference("customGoal", event.target.value)}
                />
                <SectionActions
                  hasChanges={hasSectionChanges("player-profile")}
                  isSaving={isSaving}
                  statusMessage={sectionMessages["player-profile"]}
                  onSave={() => saveSection("player-profile")}
                  onReset={() => confirmResetSection("player-profile")}
                />
              </fieldset>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
