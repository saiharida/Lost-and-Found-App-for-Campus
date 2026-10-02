const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendResetOtpEmail } = require('../utils/sendEmail');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const ALLOWED_USER_TYPES = ['Student', 'Faculty', 'Staff'];

const ROLE_TO_USER_TYPE = { student: 'Student', faculty: 'Faculty', staff: 'Staff', admin: 'Admin' };

// Consistent auth response for register / login / admin-login
const authResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  userType: ROLE_TO_USER_TYPE[user.role] || 'Admin',
  mobileNumber: user.phone || '',
  phone: user.phone || '',
  token: generateToken(user._id),
});

const registerUser = async (req, res) => {
  try {
    const { name, email, password, mobileNumber, userType } = req.body;

    if (!name || !email || !password || !mobileNumber || !userType) {
      return res.status(400).json({
        message: 'Please provide name, email, password, mobile number, and user type',
      });
    }

    if (!ALLOWED_USER_TYPES.includes(userType)) {
      return res.status(400).json({ message: 'userType must be Student, Faculty, or Staff' });
    }

    const cleanMobile = String(mobileNumber).trim();
    if (!/^[0-9]{10}$/.test(cleanMobile)) {
      return res.status(400).json({ message: 'Please provide a valid 10-digit mobile number' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();
    const allowedDomain = '@mgits.ac.in';

    // Explicit bypass for your admin email
    const isSpecialAdminEmail = cleanEmail === 'saiharida2004@gmail.com';

    if (!isSpecialAdminEmail && !cleanEmail.endsWith(allowedDomain)) {
      return res.status(400).json({ 
        message: 'Only campus email addresses (@mgits.ac.in) are permitted.' 
      });
    }

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists. If it exists, please delete it from MongoDB or log in.' });
    }

    // Automatically assign 'admin' role if it's your specific email, otherwise use the selected userType
    const assignedRole = isSpecialAdminEmail ? 'admin' : userType.toLowerCase();

    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      password,
      phone: cleanMobile,
      role: assignedRole,
    });

    res.status(201).json(authResponse(user));
  } catch (err) {
    console.error('Register Error:', err);
    res.status(500).json({ message: err.message || 'Server error during registration' });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const cleanEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: cleanEmail }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.isSuspended === true) {
      return res.status(403).json({
        message: `Your account is suspended: ${user.suspensionReason || 'Please contact campus administration.'}`,
        isSuspended: true,
      });
    }

    res.json(authResponse(user));
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: err.message || 'Server error during login' });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const isSpecialAdminEmail = cleanEmail === 'saiharida2004@gmail.com';

    if (!isSpecialAdminEmail && !cleanEmail.endsWith('@mgits.ac.in')) {
      return res.status(400).json({ message: 'Only permitted email addresses are allowed.' });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ message: 'No registered user found with this email.' });
    }

    // 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP before storing
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    user.resetOtp = hashedOtp;
    user.resetOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    await sendResetOtpEmail(cleanEmail, otp);

    res.status(200).json({ message: 'Verification OTP sent to your registered email.' });
  } catch (err) {
    console.error('Forgot Password Error:', err);
    res.status(500).json({ message: 'Failed to send reset OTP.', error: err.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const hashedInputOtp = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');

    const user = await User.findOne({
      email: cleanEmail,
      resetOtp: hashedInputOtp,
      resetOtpExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    user.password = newPassword;
    user.resetOtp = null;
    user.resetOtpExpires = null;
    await user.save();

    res.status(200).json({ message: 'Password reset successfully! You can now log in.' });
  } catch (err) {
    console.error('Reset Password Error:', err);
    res.status(500).json({ message: 'Failed to reset password.', error: err.message });
  }
};

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide admin email and password.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: cleanEmail }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid admin credentials.' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. You do not have administrator permissions.' });
    }

    if (user.isSuspended) {
      return res.status(403).json({ message: 'Administrator account is suspended.' });
    }

    res.json(authResponse(user));
  } catch (err) {
    console.error('Admin Login Error:', err);
    res.status(500).json({ message: err.message || 'Server error during admin login.' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  adminLogin,
  forgotPassword,
  resetPassword,
};