const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Otp = require('../models/Otp');
const generateOtp = require('../utils/generateOtp');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService');

// Helper: generate JWT tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '1h',
  });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
  });
  return { accessToken, refreshToken };
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, locationId } = req.body;

    const normalizedRole = role ? role.toLowerCase() : 'staff';

    // If staff, require location
    if (normalizedRole === 'staff' && !locationId) {
      return res.status(400).json({ success: false, message: 'Location is required for staff members' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters with 1 uppercase letter and 1 number',
      });
    }

    // Create user (not active until OTP verified)
    const user = await User.create({
      name,
      email,
      passwordHash: password, // Will be hashed by pre-save hook
      role: normalizedRole,
      locationId: normalizedRole === 'staff' ? locationId : undefined,
      isActive: false,
    });

    // Generate and send OTP
    const { code, expiresAt } = generateOtp();
    await Otp.create({ userId: user._id, otpCode: code, expiresAt });

    await sendVerificationEmail(email, name, code);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email with the OTP sent.',
      data: { userId: user._id, email: user.email },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account not activated. Please verify your email first.',
      });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    // Set cookie
    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    res.json({
      success: true,
      data: {
        user: { id: user._id, name: user.name, email: user.email, role: user.role, locationId: user.locationId },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logout = async (req, res, next) => {
  try {
    // Clear refresh token
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });

    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 5 * 1000),
      httpOnly: true,
    });

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send OTP to user email
 * @route   POST /api/auth/send-otp
 * @access  Public
 */
exports.sendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check retry limit (max 3 active OTPs)
    const activeOtps = await Otp.countDocuments({
      userId: user._id,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (activeOtps >= 3) {
      return res.status(429).json({
        success: false,
        message: 'Maximum OTP retries reached. Please wait for existing OTPs to expire.',
      });
    }

    const { code, expiresAt } = generateOtp();
    await Otp.create({ userId: user._id, otpCode: code, expiresAt });

    // Determine if this is for password reset or verification
    if (user.isActive) {
      await sendPasswordResetEmail(email, user.name, code);
    } else {
      await sendVerificationEmail(email, user.name, code);
    }

    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify OTP (activates account)
 * @route   POST /api/auth/verify-otp
 * @access  Public
 */
exports.verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const otpRecord = await Otp.findOne({
      userId: user._id,
      otpCode: otp,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    // Activate account
    user.isActive = true;
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, message: 'OTP verified successfully. Account activated.' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password (after OTP verification)
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Validate password strength
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters with 1 uppercase letter and 1 number',
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify the OTP
    const otpRecord = await Otp.findOne({
      userId: user._id,
      otpCode: otp,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    // Update password
    user.passwordHash = newPassword; // Will be hashed by pre-save hook
    await user.save();

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current logged-in user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        locationId: user.locationId,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};
