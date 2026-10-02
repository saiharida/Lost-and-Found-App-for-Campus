const User = require('../models/User');

const USER_TYPE_ROLES = ['student', 'faculty', 'staff'];

const toUserType = (role) => {
  const map = { student: 'Student', faculty: 'Faculty', staff: 'Staff' };
  return map[role] || null;
};

// Shape returned to the client (never includes the password)
const profileResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  userType: toUserType(user.role),
  phone: user.phone || '',
  mobileNumber: user.phone || '',
  strikeCount: user.strikeCount || 0,
});

// GET /api/users/profile
async function getUserProfile(req, res) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.status(200).json(profileResponse(user));
  } catch (err) {
    console.error('getUserProfile error:', err);
    res.status(500).json({ message: 'Failed to load profile.', error: err.message });
  }
}

// PUT /api/users/profile
async function updateUserProfile(req, res) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const { name, phone, mobileNumber, role } = req.body;

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ message: 'Name cannot be empty.' });
      }
      user.name = String(name).trim();
    }

    const newPhone = phone !== undefined ? phone : mobileNumber;
    if (newPhone !== undefined) {
      const cleanPhone = String(newPhone).trim();
      if (cleanPhone.length > 20) {
        return res.status(400).json({ message: 'Phone number is too long.' });
      }
      user.phone = cleanPhone;
    }

    // Users may switch between Student / Faculty / Staff only.
    // Admin status can never be granted or removed from this endpoint.
    if (role !== undefined && user.role !== 'admin') {
      const nextRole = String(role).toLowerCase();
      if (USER_TYPE_ROLES.includes(nextRole)) {
        user.role = nextRole;
      }
    }

    await user.save();
    res.status(200).json(profileResponse(user));
  } catch (err) {
    console.error('updateUserProfile error:', err);
    res.status(500).json({ message: 'Failed to update profile.', error: err.message });
  }
}

module.exports = {
  getUserProfile,
  updateUserProfile,
};
