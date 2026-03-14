const crypto = require('crypto');

/**
 * Generate a 6-digit OTP
 * @returns {{ code: string, expiresAt: Date }}
 */
const generateOtp = () => {
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return { code, expiresAt };
};

module.exports = generateOtp;
