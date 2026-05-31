const nodemailer = require("nodemailer");

function toBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  const v = String(value).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "y";
}

function toInt(value, defaultValue) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : defaultValue;
}

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = toInt(process.env.SMTP_PORT, SMTP_HOST ? 587 : undefined);
const SMTP_SECURE = toBool(process.env.SMTP_SECURE, false);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

let transporter;
let transportLabel = "";

// Prefer explicit SMTP configuration (most reliable for production).
if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
  transportLabel = "smtp";
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    // Better observability in production; does not log credentials.
    logger: toBool(process.env.SMTP_LOGGER, false),
    debug: toBool(process.env.SMTP_DEBUG, false),
    connectionTimeout: toInt(process.env.SMTP_CONNECTION_TIMEOUT_MS, 20_000),
    greetingTimeout: toInt(process.env.SMTP_GREETING_TIMEOUT_MS, 20_000),
    socketTimeout: toInt(process.env.SMTP_SOCKET_TIMEOUT_MS, 20_000)
  });
} else {
  // Fallback: legacy Gmail transport
  transportLabel = "gmail";
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    logger: toBool(process.env.SMTP_LOGGER, false),
    debug: toBool(process.env.SMTP_DEBUG, false),
    connectionTimeout: toInt(process.env.SMTP_CONNECTION_TIMEOUT_MS, 20_000),
    greetingTimeout: toInt(process.env.SMTP_GREETING_TIMEOUT_MS, 20_000),
    socketTimeout: toInt(process.env.SMTP_SOCKET_TIMEOUT_MS, 20_000)
  });
}

// Expose some metadata for startup logging.
transporter.__transportLabel = transportLabel;
transporter.__smtpHost = SMTP_HOST || "smtp.gmail.com";
transporter.__smtpPort = SMTP_PORT || 465;

module.exports = transporter;
