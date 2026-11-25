"use client";

import { useState } from "react";
import { UserRound, MessageSquare, Target, MonitorPlay, ShieldCheck } from "lucide-react";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { ReplayTooltipSetting } from "@/components/settings/replay-tooltip-setting";
import { AccountManagement } from "@/components/account/account-management";
import { LeaderboardPrivacy } from "@/components/leaderboard/leaderboard-privacy";

const categories = [
  {
    id: "coaching",
    title: "Coaching",
    icon: MessageSquare,
    description: "Tone and explanation detail",
  },
  {
    id: "player",
    title: "Player preferences",
    icon: Target,
    description: "Experience and goals",
  },
  {
    id: "replay",
    title: "Replay & interface",
    icon: MonitorPlay,
    description: "Grades and replay controls",
  },
  {
    id: "privacy",
    title: "Privacy",
    icon: ShieldCheck,
    description: "Public leaderboard visibility",
  },
  {
    id: "account",
    title: "Account",
    icon: UserRound,
    description: "Email, password and sessions",
  },
] as const;

type Category = (typeof categories)[number]["id"];

export function SettingsWorkspace({ deletionEnabled }: { deletionEnabled: boolean }) {
  const [category, setCategory] = useState<Category>("coaching");
  const [preferenceCategory, setPreferenceCategory] = useState<"coaching" | "player">(
    "coaching",
  );
  const preferencesVisible = category === "coaching" || category === "player";

  function selectCategory(next: Category) {
    if (next === "coaching" || next === "player") setPreferenceCategory(next);
    setCategory(next);
  }

  return (
    <div className="settings-workspace">
      <nav className="settings-category-bar" aria-label="Settings categories">
        {categories.map(({ id, title, icon: Icon, description }) => (
          <button
            key={id}
            type="button"
            className="settings-category-button"
            aria-pressed={category === id}
            aria-controls={
              id === "coaching" || id === "player"
                ? "settings-pane-preferences"
                : `settings-pane-${id}`
            }
            onClick={() => selectCategory(id)}
          >
            <Icon size={19} aria-hidden="true" />
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
          </button>
        ))}
      </nav>
      {/* Keep the panels mounted so drafts and pending operations survive category changes. */}
      <div
        id="settings-pane-preferences"
        className="settings-workspace-pane"
        hidden={!preferencesVisible}
      >
        <p className="settings-storage-note">
          Coaching and player preferences are saved to your account when signed in, or to
          this browser as a guest. Use the save buttons to keep changes.
        </p>
        <SettingsPanel category={preferenceCategory} />
      </div>
      <div
        id="settings-pane-replay"
        className="settings-workspace-pane"
        hidden={category !== "replay"}
      >
        <p className="settings-storage-note">
          Changes here save immediately. Automatic grades follow your account when signed
          in. Replay view and tooltips are saved in this browser only.
        </p>
        <ReplayTooltipSetting />
      </div>
      <div
        id="settings-pane-privacy"
        className="settings-workspace-pane"
        hidden={category !== "privacy"}
      >
        <p className="settings-storage-note">
          Leaderboard visibility is saved to your account. This does not change private
          match history, statistics or XP.
        </p>
        <LeaderboardPrivacy />
      </div>
      <div
        id="settings-pane-account"
        className="settings-workspace-pane"
        hidden={category !== "account"}
      >
        <AccountManagement deletionEnabled={deletionEnabled} />
      </div>
    </div>
  );
}
