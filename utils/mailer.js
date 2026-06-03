const axios = require("axios");

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "AL ABUZER PERFUMES";
const EMAIL_FROM = process.env.EMAIL_USER;

async function sendMail(options = {}) {
  if (!BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY not configured");
  }

  const response = await axios.post(
    "https://api.brevo.com/v3/smtp/email",
    {
      sender: {
        name: EMAIL_FROM_NAME,
        email: EMAIL_FROM
      },
      to: [
        {
          email: options.to
        }
      ],
      subject: options.subject,
      htmlContent: options.html || "",
      textContent: options.text || ""
    },
    {
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json"
      }
    }
  );

  console.log("[mailer] Brevo email sent:", response.data);

  return response.data;
}

async function verify() {
  if (!BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY missing");
  }

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