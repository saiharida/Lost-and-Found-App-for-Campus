const nodemailer = require('nodemailer');
const Notification = require('../models/Notification');
const User = require('../models/User');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify transporter connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ [Nodemailer Transporter Error]:', error.message);
  } else {
    console.log('✅ [Nodemailer Ready]: SMTP server is configured and ready.');
  }
});

async function sendNotification({ recipientId, senderId, itemId, type = 'item_claimed', subject, message }) {
  try {
    // 1. Create In-App Notification
    await Notification.create({
      recipient: recipientId,
      sender: senderId,
      item: itemId,
      type,
      message,
    });
    console.log(`[Notification] In-app record saved for user: ${recipientId}`);

    // 2. Fetch recipient
    const recipient = await User.findById(recipientId).select('email name').lean();
    
    if (!recipient) {
      console.warn('[Notification] Recipient user not found in DB.');
      return;
    }

    if (!recipient.email) {
      console.warn(`[Notification] Recipient (${recipient.name}) has no email address.`);
      return;
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('[Notification] EMAIL_USER or EMAIL_PASS missing in .env!');
      return;
    }

    console.log(`[Notification] Dispatching email to: ${recipient.email}`);

    const mailOptions = {
      from: `"LoKey Alerts" <${process.env.EMAIL_USER}>`,
      to: recipient.email,
      subject: subject || 'New Update on LoKey',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #047857; margin-top: 0;">LoKey Notification</h2>
          <p style="font-size: 15px; color: #1e293b; line-height: 1.5;">${message.replace(/\n/g, '<br>')}</p>
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
          <p style="font-size: 12px; color: #94a3b8;">Log into your LoKey portal to view and verify details.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [Notification] Email sent successfully! MessageId: ${info.messageId}`);
  } catch (err) {
    console.error('❌ [Notification Error]:', err.message);
  }
}

module.exports = { sendNotification };