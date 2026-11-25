import "server-only";

export async function sendDeletionCode(email: string, code: string): Promise<boolean> {
  const key = process.env.RESEND_ACCOUNT_DELETION_API_KEY;
  if (!key) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "MindSweeper Coach <noreply@mindsweepercoach.com>",
        to: [email],
        subject: "Verify your MindSweeper Coach account deletion",
        text: `Your account deletion verification code is ${code}.\n\nIt expires in 10 minutes and can only be used once. Enter it in your account settings to confirm permanent deletion. Never share this code. If you did not request deletion, ignore this email and secure your account.`,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
