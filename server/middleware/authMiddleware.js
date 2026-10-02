const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_jwt_key');

      req.user = await User.findById(decoded.id || decoded._id).select('-password');
      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Strict boolean check: only block if isSuspended is explicitly true
      if (req.user.isSuspended === true) {
        return res.status(403).json({
          message: `Your account is suspended: ${req.user.suspensionReason || 'Please contact campus administration.'}`,
          isSuspended: true,
        });
      }

      return next();
    } catch (err) {
      console.error('Auth verification error:', err.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  return res.status(401).json({ message: 'Not authorized, no token' });
};

// Middleware to restrict access to administrator-only endpoints
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Administrative privileges required.' });
  }
  next();
};

module.exports = {
  protect,
  requireAuth: protect,
  requireAdmin,
};