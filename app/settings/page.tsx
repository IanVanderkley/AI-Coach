import { Navbar } from "@/components/play/navbar";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";

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
            <p className="eyebrow">MAKE AI-COACH YOURS</p>
            <h1>
              Settings<span className="title-period">.</span>
            </h1>
            <p className="page-subtitle">
              Manage your account, coaching preferences, replay and privacy.
            </p>
          </div>
        </div>

        <SettingsWorkspace
          deletionEnabled={process.env.ACCOUNT_DELETION_ENABLED === "true"}
        />
      </main>
    </>
  );
}
