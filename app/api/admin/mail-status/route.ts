import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { isMailConfigured } from '@/lib/mail';

/**
 * Diagnostic endpoint — checks whether outbound mail is configured AND whether
 * the SMTP credentials authenticate successfully. Does NOT send any mail.
 *
 * Safe to leave ungated: returns only the GMAIL_USER address (which is not a
 * secret) and a boolean for whether SMTP auth works. Never returns the
 * password.
 */
export async function GET() {
  const configured = isMailConfigured();
  const user = process.env.GMAIL_USER ?? null;

  if (!configured) {
    return NextResponse.json({
      configured: false,
      user,
      verifyOk: false,
      verifyError: 'GMAIL_USER and/or GMAIL_APP_PASSWORD are not set in the environment.',
    });
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER!,
      pass: (process.env.GMAIL_APP_PASSWORD ?? '').replace(/\s+/g, ''),
    },
  });

  try {
    await transporter.verify();
    return NextResponse.json({
      configured: true,
      user,
      verifyOk: true,
      message: 'SMTP auth succeeded. Outbound mail is ready.',
    });
  } catch (e) {
    return NextResponse.json({
      configured: true,
      user,
      verifyOk: false,
      verifyError: e instanceof Error ? e.message : String(e),
    });
  }
}
