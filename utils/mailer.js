const nodemailer = require("nodemailer");

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "AL ABUZER PERFUMES";

function toAddressString(to) {
  if (Array.isArray(to)) {
    const recipients = to
      .map((entry) => {
        if (!entry) return "";
        if (typeof entry === "string") return entry.trim();
        if (typeof entry === "object" && entry.email) {
          return String(entry.email).trim();
        }
        return "";
      })
      .filter(Boolean);
    return recipients.join(",");
  }

  if (typeof to === "string") return to.trim();
  if (typeof to === "object" && to?.email) {
    return String(to.email).trim();
  }
  return "";
}

let transporter =
  SMTP_HOST && SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS
        }
      })
    : null;

function getTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    const configError = new Error("Gmail mailer is not configured");
    configError.code = "MAILER_CONFIG";
    throw configError;
  }

  return transporter;
}

async function sendMail(options = {}) {
  const to = toAddressString(options.to);
  if (!to) {
    const invalidRecipientError = new Error("Valid recipient email is required");
    invalidRecipientError.code = "MAILER_INVALID_RECIPIENT";
    throw invalidRecipientError;
  }

  if (!options.subject) {
    const invalidSubjectError = new Error("Email subject is required");
    invalidSubjectError.code = "MAILER_INVALID_SUBJECT";
    throw invalidSubjectError;
  }

  if (!options.html && !options.text) {
    const invalidBodyError = new Error("Either html or text body is required");
    invalidBodyError.code = "MAILER_INVALID_BODY";
    throw invalidBodyError;
  }

  const info = await getTransporter().sendMail({
    from: `"${EMAIL_FROM_NAME}" <${SMTP_USER}>`,
    to,
    subject: options.subject,
    html: options.html,
    text: options.text
  });

  console.log("[mailer] sendMail transport:", {
    activeTransport: "smtp",
    provider: SMTP_HOST,
    accepted: info.accepted
  });

  return {
    messageId: info.messageId,
    provider: "gmail"
  };
}

async function verify() {
  return getTransporter().verify();
}

module.exports = {
  sendMail,
  verify,
  __transportLabel: "smtp",
  __provider: SMTP_HOST,
  __endpoint: SMTP_HOST,
  __senderEmail: SMTP_USER
};
