const StockPicking = require('../models/StockPicking');
const StockAdjustment = require('../models/StockAdjustment');

/**
 * Generate auto-incrementing reference numbers
 * Format: WH/IN/00001, WH/OUT/00001, WH/INT/00001, ADJ/00001
 */
const PREFIXES = {
  IN: 'WH/IN',
  OUT: 'WH/OUT',
  INTERNAL: 'WH/INT',
  ADJUSTMENT: 'ADJ',
};

const generateReference = async (type) => {
  const prefix = PREFIXES[type];
  if (!prefix) throw new Error(`Invalid reference type: ${type}`);

  let lastRef;

  if (type === 'ADJUSTMENT') {
    lastRef = await StockAdjustment.findOne({
      reference: { $regex: `^${prefix}/` },
    })
      .sort({ createdAt: -1 })
      .select('reference');
  } else {
    lastRef = await StockPicking.findOne({
      reference: { $regex: `^${prefix}/` },
    })
      .sort({ createdAt: -1 })
      .select('reference');
  }

  let nextNum = 1;
  if (lastRef && lastRef.reference) {
    const parts = lastRef.reference.split('/');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  return `${prefix}/${String(nextNum).padStart(5, '0')}`;
};

module.exports = generateReference;
