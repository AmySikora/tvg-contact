const express = require("express");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const cors = require("cors");
require("dotenv").config();

const app = express();

// ✅ CORS — allow your website to call the API
const allowed = process.env.ALLOWED_ORIGIN?.split(",").map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowed?.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  }
}));

app.use(express.json({ limit: "100kb" }));

// ✅ Optional: serve static assets if you add a /public folder later
app.use(express.static("public"));

// ✅ Basic rate limit to stop spam bursts
app.use("/api/contact", rateLimit({ windowMs: 60_000, max: 5 }));

const clean = (s = "") => String(s).trim().replace(/\s+/g, " ");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
});

// ✅ Contact form endpoint
app.post("/api/contact", async (req, res) => {
  const { name, email, message, website } = req.body || {};

  // Honeypot to block bots
  if (website) return res.status(200).json({ ok: true });

  if (!email || !message) {
    return res.status(400).json({ ok: false, error: "Email and message required." });
  }

  const fromName = clean(name || "Website Visitor");
  const fromEmail = clean(email);
  const bodyText = `From: ${fromName} <${fromEmail}>\n\n${clean(message)}`;
  const bodyHtml = `<p><strong>From:</strong> ${fromName} &lt;${fromEmail}&gt;</p><p>${clean(message)}</p>`;

  try {
    // Send to you
    await transporter.sendMail({
      from: `TicketVeriGuard Contact <${process.env.MAIL_USER}>`,
      to: process.env.RCPT_TO,
      replyTo: fromEmail,
      subject: `New website inquiry from ${fromName}`,
      text: bodyText,
      html: bodyHtml,
    });

    // Optional auto-reply
    await transporter.sendMail({
      from: `TicketVeriGuard <${process.env.MAIL_USER}>`,
      to: fromEmail,
      subject: "Thanks — we received your message",
      text: "Thanks for reaching out to TicketVeriGuard. We’ll reply shortly.",
      html: "<p>Thanks for reaching out to <strong>TicketVeriGuard</strong>. We’ll reply shortly.</p>",
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Mail send failed." });
  }
});

// ✅ Health check endpoint (useful for debugging)
app.get("/api/health", (req, res) => res.json({ ok: true }));

// ✅ Root route so "/" stops 404ing in Heroku logs
app.get("/", (req, res) => {
  res.send("tvg-contact is running ✅ — try POST /api/contact");
});

// ✅ Start server
const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API on :${port}`));
