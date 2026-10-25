// Sends the login OTP through Brevo's HTTPS API (port 443).
// Render's free web services block outbound SMTP ports 25/465/587, so
// nodemailer + smtp.gmail.com:587 cannot work there.
//
// Required Render environment variables (names only):
//   BREVO_API_KEY        - Brevo API key (starts with "xkeysib-")
//   BREVO_SENDER_EMAIL   - a sender address verified in Brevo
// Optional:
//   BREVO_SENDER_NAME    - display name (defaults to "Ecommerce")

const BREVO_URL = "https://api.brevo.com/v3/smtp/email"

class EmailError extends Error {
  constructor(message, statusCode = 502) {
    super(message)
    this.name = "EmailError"
    this.statusCode = statusCode
    this.expose = true // safe to show to the client
  }
}

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const sendOtp = async (email, subject, otp) => {
  const apiKey = process.env.BREVO_API_KEY
  const senderEmail = process.env.BREVO_SENDER_EMAIL
  const senderName = process.env.BREVO_SENDER_NAME || "Ecommerce"

  if (!apiKey || !senderEmail) {
    // Server misconfiguration: log the detail, hide it from the client.
    console.error("OTP email is not configured: set BREVO_API_KEY and BREVO_SENDER_EMAIL")
    throw new EmailError("Email service is not configured", 500)
  }

  const safeEmail = escapeHtml(email)
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>OTP Verification</title></head>
<body style="font-family: Arial, sans-serif; text-align: center;">
  <div style="display:inline-block; padding:20px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color:red;">OTP Verification</h1>
    <p style="color:#666;">Hello ${safeEmail}, your One-Time Password for account verification is:</p>
    <p style="font-size:36px; color:#7b68ee;">${otp}</p>
  </div>
</body>
</html>`

  let response
  try {
    response = await fetch(BREVO_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email }],
        subject,
        htmlContent
      }),
      signal: AbortSignal.timeout(10000)
    })
  } catch (err) {
    console.error("OTP email request failed:", err.name, err.message)
    throw new EmailError("Could not send the OTP email. Please try again.")
  }

  if (!response.ok) {
    // Log provider status/body server-side only (never the API key).
    const detail = await response.text().catch(() => "")
    console.error(`OTP email provider returned ${response.status}: ${detail.slice(0, 300)}`)
    throw new EmailError("Could not send the OTP email. Please try again.")
  }
}

export { EmailError }
export default sendOtp