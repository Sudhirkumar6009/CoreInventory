const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const { protect } = require('../middleware/auth');
const {
  register,
  login,
  logout,
  sendOtp,
  verifyOtp,
  resetPassword,
  getMe,
} = require('../controllers/authController');

// Apply rate limiter to all auth routes
router.use(authLimiter);

// @route   POST /api/auth/register
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain an uppercase letter')
      .matches(/\d/)
      .withMessage('Password must contain a number'),
    body('role').optional().toLowerCase().isIn(['manager', 'staff']).withMessage('Role must be manager or staff'),
  ],
  validate,
  register
);

// @route   POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

// @route   POST /api/auth/logout
router.post('/logout', protect, logout);

// @route   POST /api/auth/send-otp
router.post(
  '/send-otp',
  [body('email').isEmail().withMessage('Valid email is required')],
  validate,
  sendOtp
);

// @route   POST /api/auth/verify-otp
router.post(
  '/verify-otp',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  ],
  validate,
  verifyOtp
);

// @route   POST /api/auth/reset-password
router.post(
  '/reset-password',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain an uppercase letter')
      .matches(/\d/)
      .withMessage('Password must contain a number'),
  ],
  validate,
  resetPassword
);

// @route   GET /api/auth/me
router.get('/me', protect, getMe);

module.exports = router;
