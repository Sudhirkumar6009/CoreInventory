const mongoose = require('mongoose');

const stockMoveLineSchema = new mongoose.Schema(
  {
    pickingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockPicking',
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    qtyOrdered: {
      type: Number,
      required: true,
      min: 0,
    },
    qtyDone: {
      type: Number,
      default: 0,
      min: 0,
    },
    uom: {
      type: String,
      trim: true,
      default: 'units',
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
    status: {
      type: String,
      enum: ['draft', 'waiting', 'ready', 'done', 'cancelled'],
      default: 'draft',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('StockMoveLine', stockMoveLineSchema);
