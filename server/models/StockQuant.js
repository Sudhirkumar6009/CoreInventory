const mongoose = require('mongoose');

const stockQuantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
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

// Unique combination of product and location
stockQuantSchema.index({ productId: 1, locationId: 1 }, { unique: true });

module.exports = mongoose.model('StockQuant', stockQuantSchema);
