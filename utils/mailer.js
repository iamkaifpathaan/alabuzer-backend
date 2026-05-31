const axios = require("axios");

function toInt(value, defaultValue) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : defaultValue;
}

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME;
const BREVO_TIMEOUT_MS = toInt(process.env.BREVO_TIMEOUT_MS, 10_000);
const RETRY_BASE_DELAY_MS = toInt(process.env.BREVO_RETRY_BASE_DELAY_MS, 300);
const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const BREVO_ACCOUNT_ENDPOINT = "https://api.brevo.com/v3/account";

function isTransientError(err) {
  const status = err?.response?.status;
  if (status === 429 || status >= 500) return true;
  return ["ECONNABORTED", "ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN"].includes(
    err?.code
  );
}

function toRecipients(to) {
  if (Array.isArray(to)) {
    return to
      .map((entry) => {
        if (!entry) return null;
        if (typeof entry === "string") return { email: entry };
        if (typeof entry === "object" && entry.email) {
          return {
            email: String(entry.email),
            name: entry.name ? String(entry.name) : undefined
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  if (typeof to === "string" && to.trim()) return [{ email: to.trim() }];
  if (typeof to === "object" && to?.email) {
    return [{ email: String(to.email), name: to.name ? String(to.name) : undefined }];
  }
  return [];
}

function buildProviderError(err, fallbackMessage) {
  const status = err?.response?.status;
  const body = err?.response?.data;
  const message =
    body?.message || body?.code || err?.message || fallbackMessage || "Brevo request failed";
  const error = new Error(message);
  error.code = err?.code || body?.code || "BREVO_REQUEST_FAILED";
  error.status = status;
  error.provider = "brevo";
  error.response = body;
  return error;
}

async function sendMail(options = {}) {
  if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL) {
    const configError = new Error("Brevo mailer is not configured");
    configError.code = "MAILER_CONFIG";
    throw configError;
  }

  const recipients = toRecipients(options.to);
  if (!recipients.length) {
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

  const payload = {
    sender: {
      email: BREVO_SENDER_EMAIL
    },
    to: recipients,
    subject: options.subject,
    htmlContent: options.html,
    textContent: options.text
  };
  if (BREVO_SENDER_NAME) payload.sender.name = BREVO_SENDER_NAME;

  const maxAttempts = 3;
  let lastError;
  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
    try {
      const response = await axios.post(BREVO_ENDPOINT, payload, {
        timeout: BREVO_TIMEOUT_MS,
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json"
        }
      });

      console.log("[mailer] sendMail transport:", {
        activeTransport: "brevo-http",
        endpoint: BREVO_ENDPOINT,
        status: response.status
      });

      return {
        messageId: response.data?.messageId,
        provider: "brevo"
      };
    } catch (err) {
      lastError = err;
      if (attemptNumber < maxAttempts && isTransientError(err)) {
        const delayMs = Math.pow(2, attemptNumber - 1) * RETRY_BASE_DELAY_MS;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      break;
    }
  }

  throw buildProviderError(lastError, "Failed to send email via Brevo");
}

async function verify() {
  if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL) {
    const configError = new Error("Missing BREVO_API_KEY or BREVO_SENDER_EMAIL");
    configError.code = "MAILER_CONFIG";
    throw configError;
  }

  try {
    const response = await axios.get(BREVO_ACCOUNT_ENDPOINT, {
      timeout: BREVO_TIMEOUT_MS,
      headers: {
        "api-key": BREVO_API_KEY,
        Accept: "application/json"
      }
    });
    return response.status >= 200 && response.status < 300;
  } catch (err) {
    throw buildProviderError(err, "Failed to verify Brevo mail configuration");
  }
}

module.exports = {
  sendMail,
  verify,
  __transportLabel: "brevo-http",
  __provider: "brevo",
  __endpoint: BREVO_ENDPOINT,
  __senderEmail: BREVO_SENDER_EMAIL
};
