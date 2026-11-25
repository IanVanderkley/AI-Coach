# Batch 19: password recovery confirmation

The hosted Supabase Auth logs showed invalid/expired email links (403). Email prefetching is one possible cause, not a confirmed diagnosis. A recovery token should be consumed only after explicit user interaction, not by opening an email URL.

## Rollout order (local/staging only)

1. Apply this patch and run formatting, build, typecheck and tests.
2. In Supabase Authentication > URL Configuration, add `http://localhost:3000/reset-password` to permitted redirect URLs. Keep existing callbacks for signup and email changes. Add the exact staging HTTPS reset path only after that domain is configured.
3. In Authentication > Emails > Templates > Reset password, save the subject and body from the installer package (`recovery-email.html`). Do not change signup or email-change templates. The recovery request's `RedirectTo` already includes `/reset-password`; the email template adds the token hash in a URL fragment, never the query string. Keep click/open tracking off.
4. Restart the app; request one fresh link. Old links use the previous flow and must be replaced. On the first visit, the page must display a Continue button; only that click verifies the token with Supabase `verifyOtp({ token_hash, type: "recovery" })`. On success the form requires matching new passwords and rechecks the verified user before updating. It signs out globally after success. A missing, invalid, expired or reused token must not unlock the form, even if already signed in. A page reload before reset requires requesting another link.
5. Check old password fails, new password works, and another browser cannot refresh its old session. Test opening the same fresh link twice before pressing Continue: merely opening it should not consume it. Test reuse after successful verification and mismatch validation. Do not share links or token values.

The token-hash flow uses possession of the emailed single-use token instead of the PKCE verifier for recovery only. Keep links confidential. The fragment is removed from browser history on mount and is not persisted by the app. This is not proof of successful live email delivery or protection against all scanners; those must be tested. Existing signup and email-change PKCE callbacks remain unchanged. Keep account deletion disabled.

References: https://supabase.com/docs/guides/auth/auth-email-templates and https://supabase.com/docs/guides/deployment/going-into-prod.
