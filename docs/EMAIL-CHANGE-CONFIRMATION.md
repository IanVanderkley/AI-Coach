# Email change confirmation feedback

Secure email change requires approval at the current and replacement address. Supabase's PKCE verification returns a specific message instead of an authorization code after the first confirmation; the application now handles this informational response separately. Final completion still requires successful code exchange. Missing, expired, or invalid links show a recovery message instead of silently appearing successful.

The status page is presentation-only; its query parameters do not grant a session, change email addresses, or authorize operations. The actual current address is verified by Supabase and displayed in account settings. Signup and password recovery routing are preserved. No new allowed redirect URL, migration, or email template is needed.

Test both confirmation orders using a disposable account and two accessible, unused addresses. Verify the old address remains active after the first confirmation, the new address works after the second, account history remains unchanged, and an already-used or invalid link is not treated as a new confirmation. Test in the browser that initiated the change; PKCE code exchange may fail in another browser even if Supabase has completed the email change. If that happens, sign in with the updated address and check Settings.
