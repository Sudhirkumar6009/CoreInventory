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
  },
  {
    timestamps: true,
  }
);

// Index: unique short code globally (single warehouse architecture)
locationSchema.index({ shortCode: 1 }, { unique: true });

module.exports = mongoose.model('Location', locationSchema);
