/**
 * TicketVeriGuard — Contact API
 * Minimal, reliable, branded-but-clean email notifications.
 *
 * ENV (set on Heroku):
 *  - PORT
 *  - MAIL_USER           hello@ticketveriguard.com
 *  - MAIL_PASS           <16-char Google App Password>
 *  - RCPT_TO             hello@ticketveriguard.com
 *  - FROM_NAME           TicketVeriGuard
 *  - ALLOWED_ORIGIN      https://ticketveriguard.com
 *  - CORS_ORIGINS        https://ticketveriguard.com,https://www.ticketveriguard.com,http://localhost:5500
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();

// ---------- CORS ----------
const allowed = new Set(
  (process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGIN || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);

app.use(cors({
  origin(origin, cb) {
    // Allow same-origin (no Origin header) and explicit allowlist
    if (!origin || allowed.has(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type'],
  maxAge: 86400,
}));

app.use(express.json({ limit: '100kb' }));

// ---------- Rate limit ----------
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// ---------- Mail transport ----------
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// Health check for debugging
app.get('/api/health', async (_req, res) => {
  try {
    await transporter.verify();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---------- Helpers ----------
const isEmail = (s='') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const clamp = (s, n) => (s || '').slice(0, n).trim();

// ---------- Contact endpoint ----------
app.post('/api/contact', async (req, res) => {
  const { email, message, website } = req.body || {};

  // Honeypot: if "website" has content, bail silently
  if (website && String(website).trim().length > 0) {
    return res.json({ ok: true });
  }

  const fromEmail = clamp(email, 254);
  const msg = clamp(message, 4000);

  if (!isEmail(fromEmail)) {
    return res.status(400).json({ ok: false, error: 'Invalid email.' });
  }
  if (!msg) {
    return res.status(400).json({ ok: false, error: 'Message required.' });
  }

  // Subject + bodies (plain-first for deliverability)
  const subject = 'New website inquiry';

  const textBody =
`New website inquiry

From: ${fromEmail}
Message:
${msg}

—
You can reply directly to this email to contact the sender.
© ${new Date().getFullYear()} TicketVeriGuard • ticketveriguard.com`;

  // Very light HTML – white background, system fonts, large contrast.
  // No giant blocks, no images, keeps avatar & Gmail styling intact.
  const htmlBody = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#ffffff;color:#0f1726;font:14px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif">
    <div style="max-width:640px;margin:0 auto">
      <h1 style="margin:0 0 12px;font-size:20px;letter-spacing:.2px">New website inquiry</h1>
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:8px 0;width:96px;color:#475569">From</td>
          <td style="padding:8px 0"><a href="mailto:${fromEmail}" style="color:#0ea5e9;text-decoration:none">${fromEmail}</a></td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#475569">Message</td>
          <td style="padding:8px 0">
            <div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;white-space:pre-wrap">${escapeHtml(msg)}</div>
          </td>
        </tr>
      </table>

      <p style="margin:20px 0 0;color:#334155">You can reply directly to this email to contact the sender.</p>
      <p style="margin:16px 0 0;color:#64748b;font-size:12px">
        © ${new Date().getFullYear()} TicketVeriGuard •
        <a href="https://ticketveriguard.com" style="color:#0ea5e9;text-decoration:none">ticketveriguard.com</a>
      </p>
    </div>
  </body>
</html>`;

  try {
    // From header uses your Workspace account & clean brand name
    await transporter.sendMail({
      from: `"${process.env.FROM_NAME || 'TicketVeriGuard'}" <${process.env.MAIL_USER}>`,
      to: process.env.RCPT_TO || process.env.MAIL_USER,
      replyTo: fromEmail, // makes reply flow natural
      subject,
      text: textBody,
      html: htmlBody
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Mail send error:', err);
    res.status(500).json({ ok: false, error: 'Mail send failed.' });
  }
});

// ---------- Root ----------
app.get('/', (_req, res) => {
  res.status(404).send('Not found.');
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log('TVG Contact API listening on', port);
});

// Escape utility for HTML injection safety in <div>
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
