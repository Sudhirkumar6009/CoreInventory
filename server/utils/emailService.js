const nodemailer = require('nodemailer');

// Nodemailer transporter using Gmail credentials from .env
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_ID,
    pass: process.env.GMAIL_PASSWORD,
  },
});

// Verify transporter on startup
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Nodemailer configuration error:', error.message);
  } else {
    console.log('✅ Nodemailer is ready to send emails');
  }
});

/**
 * Send OTP email for account verification
 */
const sendVerificationEmail = async (email, name, otp) => {
  const mailOptions = {
    from: `"CoreInventory" <${process.env.GMAIL_ID}>`,
    to: email,
    subject: 'CoreInventory — Email Verification OTP',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">CoreInventory</h1>
        </div>
        <h2 style="color: #333;">Email Verification</h2>
        <p style="color: #666; font-size: 16px;">Hello ${name},</p>
        <p style="color: #666; font-size: 16px;">Your OTP for email verification is:</p>
        <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
          <h1 style="color: #fff; letter-spacing: 8px; margin: 0; font-size: 36px;">${otp}</h1>
        </div>
        <p style="color: #666; font-size: 14px;">This OTP is valid for <strong>10 minutes</strong>.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} CoreInventory. All rights reserved.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`✅ Verification OTP email sent to ${email}`);
};

/**
 * Send OTP email for password reset
 */
const sendPasswordResetEmail = async (email, name, otp) => {
  const mailOptions = {
    from: `"CoreInventory" <${process.env.GMAIL_ID}>`,
    to: email,
    subject: 'CoreInventory — Password Reset OTP',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">CoreInventory</h1>
        </div>
        <h2 style="color: #333;">Password Reset</h2>
        <p style="color: #666; font-size: 16px;">Hello ${name},</p>
        <p style="color: #666; font-size: 16px;">You requested a password reset. Use the OTP below to proceed:</p>
        <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
          <h1 style="color: #fff; letter-spacing: 8px; margin: 0; font-size: 36px;">${otp}</h1>
        </div>
        <p style="color: #666; font-size: 14px;">This OTP is valid for <strong>10 minutes</strong>.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request this, your account is safe — just ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} CoreInventory. All rights reserved.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`✅ Password reset OTP email sent to ${email}`);
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
