const mongoose = require('mongoose');
const StockAdjustment = require('../models/StockAdjustment');
const StockQuant = require('../models/StockQuant');
const StockMove = require('../models/StockMove');
const Product = require('../models/Product');
const generateReference = require('../utils/generateReference');

const normalizeLines = async (inputLines = [], locationId) => {
  const normalized = [];

  for (const raw of inputLines) {
    const productId = raw?.productId || raw?.product?._id || raw?.product?.id;
    const productName = (raw?.productName || raw?.itemName || '').trim();

    let product = null;
    if (productId) {
      product = await Product.findById(productId).select('name sku').lean();
    } else if (productName) {
      product = await Product.findOne({ name: productName }).select('name sku').lean();
    }

    if (!product) continue;

    const quant = await StockQuant.findOne({ productId: product._id, locationId }).select('quantity').lean();
    const recordedQty = Number(quant?.quantity || 0);
    const updatedQty = Number(raw?.updatedQty ?? raw?.countedQty ?? raw?.qty ?? 0);

    if (!Number.isFinite(updatedQty)) continue;

    normalized.push({
      productId: product._id,
      itemName: product.name,
      sku: product.sku || '',
      recordedQty,
      updatedQty,
      delta: updatedQty - recordedQty,
    });
  }

  return normalized;
};

const applyAdjustmentLines = async (session, adjustment, userId) => {
  for (const line of adjustment.lines) {
    await StockQuant.findOneAndUpdate(
      { productId: line.productId, locationId: adjustment.locationId },
      { $inc: { quantity: line.delta } },
      { upsert: true, session }
    );

    await StockMove.create(
      [
        {
          reference: adjustment.reference,
          adjustmentId: adjustment._id,
          productId: line.productId,
          fromLocationId: line.delta < 0 ? adjustment.locationId : null,
          toLocationId: line.delta >= 0 ? adjustment.locationId : null,
          quantity: Math.abs(line.delta),
          moveType: 'ADJUSTMENT',
          status: 'done',
          createdBy: userId,
        },
      ],
      { session }
    );
  }
};

const reverseAdjustmentLines = async (session, adjustment, userId) => {
  for (const line of adjustment.lines) {
    const reverseDelta = -Number(line.delta || 0);

    await StockQuant.findOneAndUpdate(
      { productId: line.productId, locationId: adjustment.locationId },
      { $inc: { quantity: reverseDelta } },
      { upsert: true, session }
    );

    await StockMove.create(
      [
        {
          reference: `${adjustment.reference}-REV`,
          adjustmentId: adjustment._id,
          productId: line.productId,
          fromLocationId: reverseDelta < 0 ? adjustment.locationId : null,
          toLocationId: reverseDelta >= 0 ? adjustment.locationId : null,
          quantity: Math.abs(reverseDelta),
          moveType: 'ADJUSTMENT',
          status: 'done',
          createdBy: userId,
        },
      ],
      { session }
    );
  }
};

/**
 * @desc    Get all adjustments
 * @route   GET /api/adjustments
 * @access  Private
 */
exports.getAdjustments = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 25 } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [{ reference: { $regex: search, $options: 'i' } }];
    }

    const total = await StockAdjustment.countDocuments(filter);
    const adjustments = await StockAdjustment.find(filter)
      .populate('lines.productId', 'name sku uom')
      .populate('locationId', 'name shortCode')
      .populate('createdBy', 'name email')
      .sort('-createdAt')
      .skip((parseInt(page, 10) - 1) * parseInt(limit, 10))
      .limit(parseInt(limit, 10))
      .lean();

    res.json({
      success: true,
      data: adjustments,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create adjustment and apply deltas immediately
 * @route   POST /api/adjustments
 * @access  Private
 */
exports.createAdjustment = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let committed = false;

  try {
    const { reference: incomingRef, locationId, location, date, lines = [] } = req.body;
    const resolvedLocationId =
      req.user.role === 'staff' && req.user.locationId
        ? req.user.locationId
        : locationId || location;

    if (!resolvedLocationId) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'locationId is required' });
    }

    const normalizedLines = await normalizeLines(lines, resolvedLocationId);
    if (normalizedLines.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'At least one valid product line is required' });
    }

    let reference = incomingRef?.trim();
    if (reference) {
      const exists = await StockAdjustment.exists({ reference }).session(session);
      if (exists) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: 'Reference already exists' });
      }
    } else {
      reference = await generateReference('ADJUSTMENT');
    }

    const [adjustment] = await StockAdjustment.create(
      [
        {
          reference,
          locationId: resolvedLocationId,
          adjustmentDate: date ? new Date(date) : new Date(),
          lines: normalizedLines,
          createdBy: req.user._id,
        },
      ],
      { session }
    );

    await applyAdjustmentLines(session, adjustment, req.user._id);
    await session.commitTransaction();
    committed = true;

    // Populate AFTER commit so the session is no longer active
    const populated = await StockAdjustment.findById(adjustment._id)
      .populate('lines.productId', 'name sku uom')
      .populate('locationId', 'name shortCode')
      .populate('createdBy', 'name email');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    if (!committed) await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Update adjustment by reversing prior deltas and applying new lines
 * @route   PUT /api/adjustments/:id
 * @access  Private
 */
exports.updateAdjustment = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const adjustment = await StockAdjustment.findById(req.params.id).session(session);

    if (!adjustment) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Adjustment not found' });
    }

    const { reference: incomingRef, locationId, location, date, lines = [] } = req.body;
    const resolvedLocationId =
      req.user.role === 'staff' && req.user.locationId
        ? req.user.locationId
        : locationId || location || adjustment.locationId;

    if (!Array.isArray(lines) || lines.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'At least one valid product line is required' });
    }

    if (incomingRef && incomingRef.trim() && incomingRef.trim() !== adjustment.reference) {
      const exists = await StockAdjustment.exists({ reference: incomingRef.trim() }).session(session);
      if (exists) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: 'Reference already exists' });
      }
      adjustment.reference = incomingRef.trim();
    }

    await reverseAdjustmentLines(session, adjustment, req.user._id);

    // Recompute recorded quantities after reversal to keep stock math accurate on edits.
    const normalizedLines = await normalizeLines(lines, resolvedLocationId);
    if (normalizedLines.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'At least one valid product line is required' });
    }

    adjustment.locationId = resolvedLocationId;
    adjustment.adjustmentDate = date ? new Date(date) : adjustment.adjustmentDate;
    adjustment.lines = normalizedLines;
    await adjustment.save({ session });

    await applyAdjustmentLines(session, adjustment, req.user._id);
    await session.commitTransaction();

    const populated = await StockAdjustment.findById(adjustment._id)
      .populate('lines.productId', 'name sku uom')
      .populate('locationId', 'name shortCode')
      .populate('createdBy', 'name email');

    res.json({ success: true, data: populated });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
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
      .populate('lines.productId', 'name sku uom')
      .populate('locationId', 'name shortCode')
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
 * @desc    Validate adjustment (deprecated, adjustments apply on save)
 */
exports.validateAdjustment = async (req, res) => {
  return res.status(400).json({ success: false, message: 'Adjustment is applied on save. Validation is not required.' });
};

/**
 * @desc    Cancel adjustment (deprecated, adjustments apply on save)
 */
exports.cancelAdjustment = async (req, res) => {
  return res.status(400).json({ success: false, message: 'Adjustment is applied on save. Cancel is not supported.' });
};
