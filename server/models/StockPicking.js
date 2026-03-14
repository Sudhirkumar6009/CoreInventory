const mongoose = require('mongoose');

const stockPickingSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    pickingType: {
      type: String,
      enum: ['IN', 'OUT', 'INTERNAL'],
      required: true,
    },
    supplierOrCustomer: {
      type: String,
      trim: true,
      default: '',
    },
    scheduledDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['draft', 'waiting', 'ready', 'done', 'cancelled'],
      default: 'draft',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    isReturned: {
      type: Boolean,
      default: false,
    },
    returnedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: populate move lines for this picking
stockPickingSchema.virtual('moveLines', {
  ref: 'StockMoveLine',
  localField: '_id',
  foreignField: 'pickingId',
  justOne: false,
});

module.exports = mongoose.model('StockPicking', stockPickingSchema);
