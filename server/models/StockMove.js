const mongoose = require('mongoose');

const stockMoveSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      trim: true,
    },
    pickingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockPicking',
      default: null,
    },
    adjustmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockAdjustment',
      default: null,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    fromLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    toLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    quantity: {
      type: Number,
      required: true,
    },
    uom: {
      type: String,
      trim: true,
      default: 'units',
    },
    moveType: {
      type: String,
      enum: ['IN', 'OUT', 'INTERNAL', 'ADJUSTMENT'],
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'waiting', 'ready', 'done', 'cancelled'],
      default: 'done',
    },
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

// Index for fast lookups
stockMoveSchema.index({ productId: 1, createdAt: -1 });
stockMoveSchema.index({ moveType: 1, createdAt: -1 });

module.exports = mongoose.model('StockMove', stockMoveSchema);
