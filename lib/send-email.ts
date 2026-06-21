import { Resend } from "resend";

export async function sendWelcomeEmail(email: string, temporaryPassword: string) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  console.log("Sending welcome email to:", email);

  const response = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "Welcome to Automate Learning Portal",
    text: [
      "Your account has been created.",
      "",
      `Email: ${email}`,
      `Temporary Password: ${temporaryPassword}`,
      "",
      "You must update your password after your first login.",
    ].join("\n"),
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
        <h2 style="color: #174778; font-size: 22px; margin-bottom: 8px;">
          Welcome to Automate Learning Portal
        </h2>

        <p style="color: #555; font-size: 15px; line-height: 1.7;">
          Your account has been created.
        </p>

        <div style="background: #F5F7FA; border-radius: 10px; padding: 20px; margin: 24px 0; border: 1px solid #E5E7EB;">
          <p style="margin: 0 0 12px 0; font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">
            Login Credentials
          </p>
          <p style="margin: 0 0 8px 0; font-size: 15px; color: #333;">
            <strong>Login Email:</strong> ${email}
          </p>
          <p style="margin: 0; font-size: 15px; color: #333;">
            <strong>Temporary Password:</strong>
            <code style="background: #fff; padding: 3px 8px; border-radius: 4px; border: 1px solid #ddd; font-size: 14px; letter-spacing: 0.5px;">
              ${temporaryPassword}
            </code>
          </p>
        </div>

        <p style="color: #555; font-size: 14px; line-height: 1.6;">
          You must update your password after your first login.
        </p>
      </div>
    `,
  });

  console.log("Welcome email response:", response);

  if (response.error) {
    console.error("Resend welcome email error:", response.error);
    throw new Error(response.error.message);
  }

  return response;
}

