import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
let resend: Resend | null = null;
if (resendApiKey) resend = new Resend(resendApiKey);

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetToken: string
): Promise<void> {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  const resetUrl = `${clientUrl}/auth/reset-password/${resetToken}`;
  console.log(`[Email] Would send password reset to ${email}: ${resetUrl}`);
  if (!resend) {
    console.log("[Email] RESEND_API_KEY not configured — skipping.");
    return;
  }
  try {
    await resend.emails.send({
      from: "Krishi Market <noreply@krishimarket.in>",
      to: email,
      subject: "Reset Your Krishi Market Password",
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family:Arial,sans-serif;background:#fbf9f4;margin:0;padding:0">
          <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
            <div style="background:#012d1d;padding:32px 24px;text-align:center">
              <h1 style="color:#c1ecd4;font-size:24px;margin:0">🌾 Krishi Market</h1>
            </div>
            <div style="padding:32px 24px">
              <h2 style="color:#012d1d;font-size:20px;margin:0 0 12px">Reset your password</h2>
              <p style="color:#414844;font-size:15px;line-height:1.6">Hi ${name},</p>
              <p style="color:#414844;font-size:15px;line-height:1.6">We received a request to reset your Krishi Market password.</p>
              <p style="text-align:center">
                <a href="${resetUrl}" style="display:inline-block;background:#012d1d;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px">Reset Password</a>
              </p>
              <p style="color:#414844;font-size:15px">This link expires in <strong>1 hour</strong>.</p>
              <div style="margin-top:24px;padding:16px;background:#f5f3ee;border-radius:8px;font-size:13px;color:#717973;word-break:break-all">
                <p>Or copy this URL: ${resetUrl}</p>
              </div>
            </div>
            <div style="padding:24px;text-align:center;border-top:1px solid #c1c8c2">
              <p style="color:#717973;font-size:12px;margin:4px 0">Krishi Market — Direct from local farms to your table.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    console.log(`[Email] Password reset email sent to ${email}`);
  } catch (error) {
    console.error(`[Email] Failed to send to ${email}:`, error);
  }
}
