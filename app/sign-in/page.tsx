import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";

import { SignInForm } from "@/components/account/sign-in-form";
import { Navbar } from "@/components/play/navbar";

export const metadata: Metadata = {
  title: "Sign In | AI-Coach",
  description: "Sign in to your AI-Coach player profile.",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <>
      <Navbar />
      <main className="account-page">
        <section className="auth-layout">
          <div className="auth-copy">
            <Link className="back-link" href="/">
              <ArrowLeft size={17} aria-hidden="true" />
              Back to Play
            </Link>

            <p className="eyebrow">BUILD YOUR HISTORY</p>
            <h2>
              One profile. Every game. Better feedback over time
              <span className="title-period">.</span>
            </h2>
            <p className="auth-copy-text">
              Your account connects saved Practice history, Ranked results, and coaching
              preferences across devices.
            </p>

            <div className="auth-benefits">
              <div>
                <Sparkles size={19} aria-hidden="true" />
                <span>
                  <strong>Personal coaching</strong>
                  Feedback that can build on your previous games.
                </span>
              </div>
              <div>
                <ShieldCheck size={19} aria-hidden="true" />
                <span>
                  <strong>Account-scoped data</strong>
                  Saved game history and coaching preferences are account-scoped.
                  Leaderboard visibility is controlled in Settings.
                </span>
              </div>
            </div>
          </div>

          <SignInForm />
        </section>
      </main>
    </>
  );
}
