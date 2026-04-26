import nodemailer, { type Transporter } from 'nodemailer';

// Lazy-cached SMTP transport. Currently wired to Gmail SMTP using an App
// Password. To migrate to a different provider later, only this file needs to
// change.
//
// Required env vars:
//   GMAIL_USER          — sophia.cranbrook@gmail.com
//   GMAIL_APP_PASSWORD  — 16-char App Password (https://myaccount.google.com/apppasswords)
// Optional:
//   GMAIL_FROM_NAME     — Display name on the From: header. Defaults to "Sophia Cranbrook".

let cached: Transporter | null = null;

function getTransporter(): Transporter {
  if (cached) return cached;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      'Gmail SMTP not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD env vars.',
    );
  }
  cached = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass: pass.replace(/\s+/g, '') },
  });
  return cached;
}

export interface SendMailOptions {
  to: string;            // "Display Name <addr@example.com>" or just an email
  subject: string;
  text: string;
  replyTo?: string;
  fromOverride?: string; // override the default From: header
}

export interface SendMailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export async function sendMail(opts: SendMailOptions): Promise<SendMailResult> {
  let transporter: Transporter;
  try {
    transporter = getTransporter();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const user = process.env.GMAIL_USER!;
  const fromName = process.env.GMAIL_FROM_NAME ?? 'Sophia Cranbrook';
  const from = opts.fromOverride ?? `${fromName} <${user}>`;

  try {
    const info = await transporter.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      replyTo: opts.replyTo,
    });
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Build a plus-addressed reply-to so replies route back to the sender's inbox
 * with a tag preserved in the To: header. Gmail supports plus-addressing
 * natively (foo+tag@gmail.com → foo@gmail.com inbox).
 */
export function buildReplyTo(tag: string): string | undefined {
  const user = process.env.GMAIL_USER;
  if (!user) return undefined;
  const [local, domain] = user.split('@');
  if (!local || !domain) return undefined;
  return `${local}+${tag}@${domain}`;
}

export function isMailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}
