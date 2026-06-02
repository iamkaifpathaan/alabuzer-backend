const nodemailer = require("nodemailer");

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
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
  EMAIL_USER && EMAIL_PASS
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS
        }
      })
    : null;

function getTransporter() {
  if (!EMAIL_USER || !EMAIL_PASS) {
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
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_USER}>`,
    to,
    subject: options.subject,
    html: options.html,
    text: options.text
  });

  console.log("[mailer] sendMail transport:", {
    activeTransport: "gmail-smtp",
    provider: "gmail",
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
  __transportLabel: "gmail-smtp",
  __provider: "gmail",
  __endpoint: "smtp.gmail.com",
  __senderEmail: EMAIL_USER
};
