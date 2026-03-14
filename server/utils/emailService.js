const nodemailer = require('nodemailer');

/**
 * Send email using nodemailer
 * Falls back to console logging in development if SMTP is not configured
 */
const sendEmail = async ({ to, subject, text, html }) => {
  // If SMTP is not configured, just log (dev mode)
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('========== EMAIL (DEV MODE) ==========');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${text}`);
    console.log('=======================================');
    return { success: true, dev: true };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: `"CoreInventory" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  };

  const info = await transporter.sendMail(mailOptions);
  return { success: true, messageId: info.messageId };
};

module.exports = sendEmail;
