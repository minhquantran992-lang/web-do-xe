const nodemailer = require('nodemailer');

const hasEnv = () =>
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS;

let transport = null;
const buildTransport = () => {
  if (!hasEnv()) return null;
  const port = Number(process.env.SMTP_PORT);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};
transport = buildTransport();

const sendEmail = async ({ to, subject, text, html }) => {
  const from = process.env.EMAIL_FROM || 'no-reply@carbanana.local';
  const usePreview = !hasEnv();
  if (usePreview) {
    console.log('--- Mail Preview (no SMTP configured) ---');
    console.log('To:', to);
    console.log('Subject:', subject);
    if (text) console.log('Text:', text);
    if (html) console.log('HTML:', html);
    console.log('--- End Mail Preview ---');
    return { ok: true, preview: true };
  }
  try {
    if (!transport) transport = buildTransport();
    let info = await transport.sendMail({ from, to, subject, text, html });
    console.log(`Email sent to ${to} with subject "${subject}" (id: ${info?.messageId || ''})`);
    return { ok: true, id: info?.messageId || null };
  } catch (err) {
    console.error('Email send failed (will retry once):', err?.message || err);
    try {
      transport = buildTransport();
      const info = await transport.sendMail({ from, to, subject, text, html });
      console.log(`Email sent to ${to} with subject "${subject}" (id: ${info?.messageId || ''})`);
      return { ok: true, id: info?.messageId || null, retried: true };
    } catch (e2) {
      console.error('Email send failed after retry:', e2?.message || e2);
      throw e2;
    }
  }
};

module.exports = { sendEmail, sendMail: sendEmail };
