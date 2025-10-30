// server.js
// Minimal contact API for TicketVeriGuard — HTML email + auto-reply
// Env: MAIL_USER, MAIL_PASS, RCPT_TO, (optional) FROM_NAME, CORS_ORIGINS

const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();

// --- Config ---
const PORT = process.env.PORT || 3000;
const FROM_EMAIL = process.env.MAIL_USER;                   // hello@ticketveriguard.com
const FROM_NAME  = process.env.FROM_NAME || 'TicketVeriGuard';
const RCPT_TO    = process.env.RCPT_TO || FROM_EMAIL;       // where you receive the lead

// CORS: allow your site + localhost during dev
const allowed = (process.env.CORS_ORIGINS || [
  'https://ticketveriguard.com',
  'https://www.ticketveriguard.com',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
]).split(',').map(s => s.trim());

app.use(cors({
  origin(origin, cb){
    if (!origin) return cb(null, true); // curl/postman
    cb(null, allowed.includes(origin));
  }
}));
app.use(express.json({ limit: '100kb' }));

// simple rate limit to avoid abuse
app.use('/api/contact', rateLimit({
  windowMs: 60 * 1000,
  max: 5
}));

// --- Mail Transport (Gmail SMTP with App Password) ---
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
});

// --- Email Template Helper ---
function renderEmail({ fromEmail, msg }) {
  const brand = FROM_NAME;
  const site  = 'https://ticketveriguard.com';
  const support = FROM_EMAIL;

  const html = `
<!doctype html>
<html>
<head><meta name="viewport" content="width=device-width,initial-scale=1"/><meta charSet="utf-8"/><title>New website inquiry</title></head>
<body style="margin:0;background:#0d1119;color:#e5e7eb;font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="width:100%;max-width:640px;background:#111826;border:1px solid #1f2937;border-radius:14px;overflow:hidden">
        <tr>
          <td style="padding:18px 22px;background:linear-gradient(90deg,rgba(79,70,229,.9),rgba(34,211,238,.9));color:#fff;font-weight:700;">
            ${brand}
          </td>
        </tr>
        <tr>
          <td style="padding:22px">
            <p style="margin:0 0 10px;color:#94a3b8;font-size:14px">New website inquiry</p>
            <p style="margin:0 0 12px">From: <strong style="color:#e5e7eb">${fromEmail}</strong></p>
            <div style="background:#0e1420;border:1px solid #1f2937;border-radius:10px;padding:14px;color:#e5e7eb;white-space:pre-wrap">
${(msg || '').trim()}
            </div>
            <p style="margin:18px 0 0">Reply directly to this email to continue the conversation.</p>
            <div style="margin:22px 0 6px;height:1px;background:#1f2937"></div>
            <p style="margin:12px 0 0">
              — TicketVeriGuard<br/>
              <a href="mailto:${support}" style="color:#22d3ee;text-decoration:none">${support}</a> ·
              <a href="${site}" style="color:#22d3ee;text-decoration:none">ticketveriguard.com</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 22px;color:#94a3b8;font-size:12px;border-top:1px solid #1f2937">
            You’re receiving this because someone submitted the contact form on ticketveriguard.com.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const text = [
    `New website inquiry`,
    ``,
    `From: ${fromEmail}`,
    ``,
    (msg || '').trim(),
    ``,
    `— TicketVeriGuard`,
    `Email: ${support}`,
    `Web: ${site}`,
  ].join('\n');

  return { html, text };
}

function renderAutoReply({ toEmail }) {
  const site  = 'https://ticketveriguard.com';
  const support = FROM_EMAIL;

  const html = `
<!doctype html>
<html>
<head><meta name="viewport" content="width=device-width,initial-scale=1"/><meta charSet="utf-8"/><title>Thanks — we got your message</title></head>
<body style="margin:0;background:#0d1119;color:#e5e7eb;font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="width:100%;max-width:640px;background:#111826;border:1px solid #1f2937;border-radius:14px;overflow:hidden">
        <tr>
          <td style="padding:18px 22px;background:linear-gradient(90deg,rgba(79,70,229,.9),rgba(34,211,238,.9));color:#fff;font-weight:700;">
            TicketVeriGuard
          </td>
        </tr>
        <tr>
          <td style="padding:22px">
            <p style="margin:0 0 12px">Thanks — we got your message.</p>
            <p style="margin:0 0 12px">We’ll reply shortly with next steps and a quick demo option.</p>
            <p style="margin:18px 0 0;color:#94a3b8;font-size:14px">If this was not you, ignore this email or write us at
            <a href="mailto:${support}" style="color:#22d3ee;text-decoration:none">${support}</a>.</p>

            <div style="margin:22px 0 6px;height:1px;background:#1f2937"></div>
            <p style="margin:12px 0 0">
              — TicketVeriGuard<br/>
              <a href="mailto:${support}" style="color:#22d3ee;text-decoration:none">${support}</a> ·
              <a href="${site}" style="color:#22d3ee;text-decoration:none">ticketveriguard.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const text = [
    `Thanks — we got your message.`,
    `We’ll reply shortly with next steps and a quick demo option.`,
    ``,
    `— TicketVeriGuard`,
    `Email: ${support}`,
    `Web: ${site}`
  ].join('\n');

  return { html, text };
}

// --- Routes ---
app.get('/', (_, res) => res.status(404).json({ ok: false, error: 'Not found' }));

app.post('/api/contact', async (req, res) => {
  try {
    const { email, message, website } = req.body || {};
    // Honeypot and minimal validation
    if (website) return res.status(200).json({ ok: true }); // bot
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'Invalid email' });
    }
    if (!message || String(message).trim().length < 2) {
      return res.status(400).json({ ok: false, error: 'Message required' });
    }

    // 1) Notify you
    const { html, text } = renderEmail({ fromEmail: email, msg: message });
    await transporter.sendMail({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: RCPT_TO,
      replyTo: email,
      subject: `New website inquiry from ${email}`,
      html,
      text,
      headers: {
        'X-Entity-Ref-ID': Date.now().toString(),
        'List-Unsubscribe': `<mailto:${FROM_EMAIL}?subject=unsubscribe>`
      }
    });

    // 2) Auto-reply to visitor (polished but short)
    const auto = renderAutoReply({ toEmail: email });
    await transporter.sendMail({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `Thanks — we received your message`,
      html: auto.html,
      text: auto.text,
      headers: { 'X-Auto-Response-Suppress': 'All' }
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('MAIL ERROR:', e);
    res.status(500).json({ ok: false, error: 'Mail send failed.' });
  }
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`tvg-contact listening on ${PORT}`);
});
