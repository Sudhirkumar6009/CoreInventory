const mongoose = require('mongoose');

const reorderRuleSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
    },
    minQty: {
      type: Number,
      required: [true, 'Minimum quantity is required'],
      min: 0,
    },
    maxQty: {
      type: Number,
      required: [true, 'Maximum quantity is required'],
      min: 0,
    },
    leadTimeDays: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// One rule per product per warehouse
reorderRuleSchema.index({ productId: 1, warehouseId: 1 }, { unique: true });

module.exports = mongoose.model('ReorderRule', reorderRuleSchema);
