# Authentication link feedback (Batch 23H.3)

The callback redirects failed signup links to sign-in with a fixed, informational error. An already-confirmed user can sign in normally; unconfirmed users can request another verification email. A failed recovery callback selects the password reset request form. Legacy generic link errors continue to work. The recovery page provides a direct request-new-link action when no verified recovery identity or usable token is present.

The notice is never proof of account ownership. No provider error text, arbitrary redirect, email, or token is copied into the feedback. The successful code exchange, email-change confirmation, credential verification, enumeration-resistant resend behavior, and explicit password-recovery verification are unchanged. No database or hosted email-template changes are part of this patch.

## Local verification

- Open `/auth/callback?kind=signup&error_code=otp_expired`: sign-in should offer sign-in first and resend if needed.
- Open `/auth/callback?kind=recovery&error_code=otp_expired`: the reset email request form should appear.
- Open `/auth/callback?kind=email&error_code=otp_expired`: the existing email-change error page should appear.
- Open `/reset-password` without a token: request a new password reset email, without exposing the password update form.
- Sign in with a confirmed local account and verify normal navigation to Profile.
- Test the actual signup and recovery emails with local Mailpit before releasing. The hosted template and email delivery behavior require separate verification; link feedback does not prevent email scanners from consuming links.
