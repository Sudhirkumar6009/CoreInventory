const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Location name is required'],
      trim: true,
    },
    shortCode: {
      type: String,
      required: [true, 'Short code is required'],
      trim: true,
      uppercase: true,
    },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: [true, 'Warehouse is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: unique short code within a warehouse
locationSchema.index({ shortCode: 1, warehouseId: 1 }, { unique: true });

module.exports = mongoose.model('Location', locationSchema);
