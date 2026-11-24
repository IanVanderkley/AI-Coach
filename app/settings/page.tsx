import { Navbar } from "@/components/play/navbar";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { LeaderboardPrivacy } from "@/components/leaderboard/leaderboard-privacy";
import { ReplayTooltipSetting } from "@/components/settings/replay-tooltip-setting";
import { AccountManagement } from "@/components/account/account-management";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to settings
      </a>
      <Navbar />

      <main className="page-shell settings-page" id="main-content" tabIndex={-1}>
        <div className="page-heading settings-heading">
          <div>
            <p className="eyebrow">MAKE COACHING YOURS</p>
            <h1>
              Settings<span className="title-period">.</span>
            </h1>
            <p className="page-subtitle">Choose how your coach communicates with you.</p>
          </div>
        </div>

        <SettingsPanel />
        <ReplayTooltipSetting />
        <AccountManagement
          deletionEnabled={process.env.ACCOUNT_DELETION_ENABLED === "true"}
        />
        <LeaderboardPrivacy />
      </main>
    </>
  );
}
