const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductCategory',
      default: null,
    },
    uom: {
      type: String,
      required: [true, 'Unit of measure is required'],
      trim: true,
      default: 'units',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    reorderPoint: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    initialStock: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Text index for search
productSchema.index({ name: 'text', sku: 'text' });

module.exports = mongoose.model('Product', productSchema);
