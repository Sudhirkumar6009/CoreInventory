const mongoose = require('mongoose');
const StockAdjustment = require('../models/StockAdjustment');
const StockQuant = require('../models/StockQuant');
const StockMove = require('../models/StockMove');
const generateReference = require('../utils/generateReference');

/**
 * @desc    Get all adjustments
 * @route   GET /api/adjustments
 * @access  Private
 */
exports.getAdjustments = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 25 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [{ reference: { $regex: search, $options: 'i' } }];
    }

    const total = await StockAdjustment.countDocuments(filter);
    const adjustments = await StockAdjustment.find(filter)
      .populate('productId', 'name sku uom')
      .populate({
        path: 'locationId',
        populate: { path: 'warehouseId', select: 'name shortCode' },
      })
      .populate('createdBy', 'name email')
      .sort('-createdAt')
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: adjustments,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create an adjustment
 * @route   POST /api/adjustments
 * @access  Private
 */
exports.createAdjustment = async (req, res, next) => {
  try {
    const { productId, locationId, countedQty, reason } = req.body;

    // Get current recorded qty
    const stockQuant = await StockQuant.findOne({ productId, locationId });
    const recordedQty = stockQuant ? stockQuant.quantity : 0;
    const delta = countedQty - recordedQty;

    const reference = await generateReference('ADJUSTMENT');

    const adjustment = await StockAdjustment.create({
      reference,
      productId,
      locationId,
      recordedQty,
      countedQty,
      delta,
      reason,
      status: 'draft',
      createdBy: req.user._id,
    });

    const populated = await StockAdjustment.findById(adjustment._id)
      .populate('productId', 'name sku uom')
      .populate({
        path: 'locationId',
        populate: { path: 'warehouseId', select: 'name shortCode' },
      })
      .populate('createdBy', 'name email');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single adjustment
 * @route   GET /api/adjustments/:id
 * @access  Private
 */
exports.getAdjustment = async (req, res, next) => {
  try {
    const adjustment = await StockAdjustment.findById(req.params.id)
      .populate('productId', 'name sku uom')
      .populate({
        path: 'locationId',
        populate: { path: 'warehouseId', select: 'name shortCode' },
      })
      .populate('createdBy', 'name email');

    if (!adjustment) {
      return res.status(404).json({ success: false, message: 'Adjustment not found' });
    }

    res.json({ success: true, data: adjustment });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Validate adjustment — apply delta to stock (atomic)
 * @route   POST /api/adjustments/:id/validate
 * @access  Private (Manager)
 */
exports.validateAdjustment = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const adjustment = await StockAdjustment.findById(req.params.id).session(session);

    if (!adjustment) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Adjustment not found' });
    }

    if (adjustment.status === 'done') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Adjustment is already validated' });
    }

    if (adjustment.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Cannot validate a cancelled adjustment' });
    }

    // Apply delta to stock quant
    await StockQuant.findOneAndUpdate(
      { productId: adjustment.productId, locationId: adjustment.locationId },
      { $inc: { quantity: adjustment.delta } },
      { upsert: true, session }
    );

    // Create immutable stock move record
    await StockMove.create(
      [
        {
          reference: adjustment.reference,
          adjustmentId: adjustment._id,
          productId: adjustment.productId,
          fromLocationId: adjustment.delta < 0 ? adjustment.locationId : null,
          toLocationId: adjustment.delta >= 0 ? adjustment.locationId : null,
          quantity: Math.abs(adjustment.delta),
          moveType: 'ADJUSTMENT',
          status: 'done',
          createdBy: req.user._id,
        },
      ],
      { session }
    );

    adjustment.status = 'done';
    await adjustment.save({ session });

    await session.commitTransaction();

    const populated = await StockAdjustment.findById(adjustment._id)
      .populate('productId', 'name sku uom')
      .populate({
        path: 'locationId',
        populate: { path: 'warehouseId', select: 'name shortCode' },
      })
      .populate('createdBy', 'name email');

    res.json({ success: true, message: 'Adjustment validated successfully', data: populated });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Cancel adjustment
 * @route   POST /api/adjustments/:id/cancel
 * @access  Private
 */
exports.cancelAdjustment = async (req, res, next) => {
  try {
    const adjustment = await StockAdjustment.findById(req.params.id);

    if (!adjustment) {
      return res.status(404).json({ success: false, message: 'Adjustment not found' });
    }

    if (adjustment.status === 'done') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a completed adjustment' });
    }

    adjustment.status = 'cancelled';
    await adjustment.save();

    res.json({ success: true, message: 'Adjustment cancelled', data: adjustment });
  } catch (error) {
    next(error);
  }
};
