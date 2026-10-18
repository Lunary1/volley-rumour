import nodemailer, { type Transporter } from "nodemailer";

// Email over SMTP (#98): Resend in production (smtp.resend.com), Mailpit on
// the local Supabase stack, so the e2e tests read the real emails. Without
// SMTP_HOST nothing is sent, e.g. a dev server without email settings.

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let transport: Transporter | null | undefined;

function getTransport() {
  if (transport !== undefined) return transport;
  const host = process.env.SMTP_HOST;
  if (!host) {
    transport = null;
    return transport;
  }
  const port = Number(process.env.SMTP_PORT ?? 465);
  const user = process.env.SMTP_USER;
  transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transport;
}

/** Sends an email. Never throws: a failed email must not fail the action. */
export async function sendEmail(email: Email) {
  const smtp = getTransport();
  if (!smtp) {
    console.warn(`Email not sent (no SMTP_HOST): ${email.subject}`);
    return;
  }
  try {
    await smtp.sendMail({
      from:
        process.env.EMAIL_FROM ?? "VolleyRumours <noreply@volleyrumours.be>",
      ...email,
    });
  } catch (error) {
    console.error("Email not sent:", error);
  }
}
