import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/play/navbar";

export const metadata: Metadata = {
  title: "Email confirmation | AI-Coach",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function EmailChangePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  // Status is informational, not proof of identity or ownership.
  const { status } = await searchParams;
  const pending = status === "pending";
  const complete = status === "complete";
  return (
    <>
      <Navbar />
      <main className="account-page">
        <section className="auth-card mx-auto w-full max-w-[480px]">
          <div className="auth-card-content">
            <p className="eyebrow">ACCOUNT EMAIL CHANGE</p>
            <h1>
              {pending
                ? "Check your other inbox."
                : complete
                  ? "Email confirmation complete."
                  : "Could not confirm this link."}
            </h1>
            <p className="mt-3">
              {pending
                ? "One confirmation has been accepted. Open the confirmation email sent to your other address to finish the change. Until both are confirmed, use your current email to sign in."
                : complete
                  ? "Check your updated email address in account settings. You can use your new email to sign in once both confirmations are complete."
                  : "The link may be expired, already used, or opened in a different browser. Check your current email in Settings before requesting another change."}
            </p>
            <div className="account-auth-links mt-6">
              <Link className="settings-button settings-button-primary" href="/settings">
                Go to Settings
              </Link>
              <Link href="/sign-in">Back to sign in</Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
