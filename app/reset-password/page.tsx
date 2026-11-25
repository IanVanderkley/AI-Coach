import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/play/navbar";
import { ResetPasswordForm } from "@/components/account/reset-password-form";

export const metadata: Metadata = {
  title: "Reset password | AI-Coach",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <>
      <Navbar />
      <main className="account-page">
        <section className="auth-card mx-auto w-full max-w-[480px]">
          <div className="auth-card-content">
            <p className="eyebrow">ACCOUNT RECOVERY</p>
            <h1>Choose a new password.</h1>
            <ResetPasswordForm />
            <div className="account-auth-links">
              <Link href="/sign-in">Back to sign in</Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
