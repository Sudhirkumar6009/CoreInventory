const mongoose = require('mongoose');

const stockQuantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      default: 0,
    },
    reservedQty: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Unique stock row per product.
stockQuantSchema.index({ productId: 1 }, { unique: true });

module.exports = mongoose.model('StockQuant', stockQuantSchema);
