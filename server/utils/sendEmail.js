const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Generic email sender for broadcasts and general notifications
async function sendEmail({ email, subject, message }) {
  const mailOptions = {
    from: `"LoKey Campus" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: subject,
    text: message,
  };

  return transporter.sendMail(mailOptions);
}

async function sendResetOtpEmail(toEmail, otp) {
  const mailOptions = {
    from: `"LoKey Campus" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Your Password Reset OTP - LoKey',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a; margin-top: 0;">Password Reset Request</h2>
        <p style="color: #475569; font-size: 14px;">
          You requested to reset your password for LoKey Campus Lost &amp; Found. Use the following One-Time Password (OTP) to complete your verification:
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #047857; background: #ecfdf5; padding: 12px 24px; border-radius: 8px; border: 1px dashed #047857;">
            ${otp}
          </span>
        </div>
        <p style="color: #64748b; font-size: 13px;">
          This OTP is valid for <strong>10 minutes</strong>. If you did not request this reset, please ignore this email.
        </p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendEmail, sendResetOtpEmail };