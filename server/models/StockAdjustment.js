const mongoose = require('mongoose');

const stockAdjustmentSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
    adjustmentDate: {
      type: Date,
      default: Date.now,
    },
    lines: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        itemName: {
          type: String,
          trim: true,
          default: '',
        },
        sku: {
          type: String,
          trim: true,
          default: '',
        },
        recordedQty: {
          type: Number,
          required: true,
        },
        updatedQty: {
          type: Number,
          required: true,
        },
        delta: {
          type: Number,
          required: true,
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('StockAdjustment', stockAdjustmentSchema);
