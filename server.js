// server.js
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const {
  PORT = 3001,
  MAIL_USER,
  MAIL_PASS,
  RCPT_TO,
  FROM_NAME = 'TicketVeriGuard',
  ALLOWED_ORIGIN,
  CORS_ORIGINS = ''
} = process.env;

if (!MAIL_USER || !MAIL_PASS || !RCPT_TO) {
  console.error('Missing MAIL_USER/MAIL_PASS/RCPT_TO envs');
}

const app = express();

// ---- CORS ----
const origins = (CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (ALLOWED_ORIGIN) origins.push(ALLOWED_ORIGIN);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    cb(null, origins.includes(origin));
  },
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowedHeaders: ['content-type'],
  credentials: false,
}));
app.use(express.json());

// ---- Mail transport (Gmail/Workspace via App Password) ----
const tx = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: MAIL_USER, pass: MAIL_PASS },
});

// Optional health check:
app.get('/health', async (req, res) => {
  try {
    await tx.verify();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---------- Helpers ----------
const escape = (s = '') => String(s).replace(/[<>&"]/g, c => (
  { '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]
));

function notifyHtml({ email, message }) {
  const safeEmail = escape(email);
  const safeMsg   = escape(message).replace(/\n/g, '<br/>');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>New Website Inquiry</title>
  <style>
    /* mobile-first */
    body{margin:0;background:#0b0f14;color:#e5e7eb;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,sans-serif;}
    .wrap{max-width:640px;margin:0 auto;padding:28px;}
    .card{background:#111826;border:1px solid rgba(255,255,255,.08);border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.35);padding:24px;}
    .brand{display:flex;align-items:center;gap:12px;margin-bottom:14px}
    .brand img{height:28px;width:28px;border-radius:6px;display:block}
    h1{font-size:20px;margin:0 0 10px}
    .muted{color:#94a3b8}
    .kv{margin:16px 0;border-collapse:separate;border-spacing:0;width:100%}
    .kv th{width:120px;text-align:left;color:#94a3b8;padding:6px 0;vertical-align:top}
    .kv td{padding:6px 0}
    .box{background:#0e1420;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px;margin-top:6px;white-space:pre-wrap}
    .footer{margin-top:18px;color:#94a3b8;font-size:13px}
    a{color:#22d3ee;text-decoration:none}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="brand">
        <img src="https://ticketveriguard.com/img/ticketveriguard.png" alt="TicketVeriGuard">
        <strong>TicketVeriGuard</strong>
      </div>
      <h1>New website inquiry</h1>
      <table class="kv" role="presentation">
        <tr><th>From</th><td>${safeEmail}</td></tr>
        <tr><th>Message</th><td><div class="box">${safeMsg}</div></td></tr>
      </table>
      <p class="muted">You can reply directly to this email to contact the sender.</p>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} TicketVeriGuard • <a href="https://ticketveriguard.com">ticketveriguard.com</a>
    </div>
  </div>
</body>
</html>`;
}

function notifyText({ email, message }) {
  return [
    'New website inquiry',
    '',
    `From: ${email}`,
    '',
    'Message:',
    message || '(no message)',
    '',
    `— TicketVeriGuard, ${new Date().getFullYear()}`
  ].join('\n');
}

// ---------- Route ----------
app.post('/api/contact', async (req, res) => {
  try {
    const { email = '', message = '', website = '' } = req.body || {};

    // simple validations + honeypot
    if (website) return res.json({ ok: true }); // bot
    const cleanEmail = String(email).trim();
    const cleanMsg   = String(message).trim();
    if (!cleanEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      return res.status(400).json({ ok: false, error: 'Bad email' });
    }
    if (!cleanMsg) {
      return res.status(400).json({ ok: false, error: 'Message required' });
    }

    // send notification to you
    await tx.sendMail({
      from: `${FROM_NAME} <${MAIL_USER}>`,
      to: RCPT_TO,
      subject: 'New website inquiry',
      html: notifyHtml({ email: cleanEmail, message: cleanMsg }),
      text: notifyText({ email: cleanEmail, message: cleanMsg }),
      replyTo: cleanEmail,
      headers: { 'X-TVG-Source': 'web-contact' }
    });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Mail send failed.' });
  }
});

app.listen(PORT, () =>
  console.log(`contact API listening on :${PORT}`)
);
