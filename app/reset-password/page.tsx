import Link from "next/link";
import { Navbar } from "@/components/play/navbar";
import { ResetPasswordForm } from "@/components/account/reset-password-form";
export default function ResetPasswordPage() {
  return (
    <>
      <Navbar />
      <main className="page-shell">
        <section className="account-management">
          <h1>Choose a new password</h1>
          <ResetPasswordForm />
          <Link href="/sign-in">Back to sign in</Link>
        </section>
      </main>
    </>
  );
}
