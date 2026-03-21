const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for auth endpoints — 100 requests per minute per IP
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after a minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter };
