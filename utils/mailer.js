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
          const email = String(entry.email).trim();
          if (!email) return "";
          if (entry.name) return `"${String(entry.name).replace(/"/g, '\\"')}" <${email}>`;
          return email;
        }
        return "";
      })
      .filter(Boolean);
    return recipients.join(",");
  }

  if (typeof to === "string") return to.trim();
  if (typeof to === "object" && to?.email) {
    const email = String(to.email).trim();
    if (!email) return "";
    if (to.name) return `"${String(to.name).replace(/"/g, '\\"')}" <${email}>`;
    return email;
  }
  return "";
}

function getTransporter() {
  if (!EMAIL_USER || !EMAIL_PASS) {
    const configError = new Error("Gmail mailer is not configured");
    configError.code = "MAILER_CONFIG";
    throw configError;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });
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

  const transporter = getTransporter();

  const info = await transporter.sendMail({
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
  const transporter = getTransporter();
  return transporter.verify();
}

module.exports = {
  sendMail,
  verify,
  __transportLabel: "gmail-smtp",
  __provider: "gmail",
  __endpoint: "smtp.gmail.com",
  __senderEmail: EMAIL_USER
};
