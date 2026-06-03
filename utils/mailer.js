const axios = require("axios");

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_FROM_NAME =
  process.env.EMAIL_FROM_NAME || "AL ABUZER PERFUMES";

const EMAIL_FROM =
  process.env.EMAIL_USER || "noreply@alabuzarperfumes.com";

function normalizeRecipient(to) {
  if (!to) return "";

  if (Array.isArray(to)) {
    return to
      .map((item) => {
        if (!item) return "";
        if (typeof item === "string") return item.trim();
        if (item.email) return String(item.email).trim();
        return "";
      })
      .filter(Boolean);
  }

  if (typeof to === "string") {
    return [to.trim()];
  }

  if (typeof to === "object" && to.email) {
    return [String(to.email).trim()];
  }

  return [];
}

async function sendMail(options = {}) {
  try {
    if (!BREVO_API_KEY) {
      throw new Error("BREVO_API_KEY is missing");
    }

    const recipients = normalizeRecipient(options.to);

    if (!recipients.length) {
      throw new Error("Recipient email is required");
    }

    if (!options.subject) {
      throw new Error("Email subject is required");
    }

    if (!options.html && !options.text) {
      throw new Error("Email body is required");
    }

    const payload = {
      sender: {
        name: EMAIL_FROM_NAME,
        email: EMAIL_FROM
      },

      to: recipients.map((email) => ({
        email
      })),

      subject: options.subject,

      htmlContent: options.html || undefined,

      textContent: options.text || undefined
    };

    console.log("[mailer] Sending email via Brevo...");
    console.log("[mailer] Sender:", EMAIL_FROM);
    console.log("[mailer] Recipients:", recipients);

    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      payload,
      {
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": BREVO_API_KEY
        },
        timeout: 30000
      }
    );

    console.log("[mailer] Email sent successfully");
    console.log("[mailer] Response:", response.data);

    return response.data;
  } catch (err) {
    console.error("========== BREVO ERROR ==========");
    console.error("STATUS:", err.response?.status);
    console.error("DATA:", err.response?.data);
    console.error("MESSAGE:", err.message);
    console.error("=================================");

    throw err;
  }
}

async function verify() {
  if (!BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY is missing");
  }

  console.log("[mailer] Brevo API configured successfully");

  return true;
}

module.exports = {
  sendMail,
  verify,

  __transportLabel: "brevo-api",
  __provider: "brevo",
  __endpoint: "https://api.brevo.com",
  __senderEmail: EMAIL_FROM
};