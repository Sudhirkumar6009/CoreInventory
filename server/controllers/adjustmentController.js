const mongoose = require('mongoose');
const StockAdjustment = require('../models/StockAdjustment');
const StockQuant = require('../models/StockQuant');
const StockMove = require('../models/StockMove');
const Product = require('../models/Product');
const generateReference = require('../utils/generateReference');

const applyAdjustmentDelta = async (session, adjustment, userId) => {
  await StockQuant.findOneAndUpdate(
    { productId: adjustment.productId },
    { $inc: { quantity: adjustment.delta } },
    { upsert: true, session }
  );

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
        createdBy: userId,
      },
    ],
    { session }
  );
};

const resolveAdjustmentPayload = async (body) => {
  let {
    productId,
    locationId,
    countedQty,
    reason,
    location,
    lines,
  } = body;

  let productName = '';

  if (Array.isArray(lines) && lines.length > 0) {
    const firstLine = lines[0] || {};
    productId = productId || firstLine.productId || firstLine.product?._id || firstLine.product?.id;
    locationId = locationId || firstLine.locationId || firstLine.toLocationId || firstLine.fromLocationId || location;
    countedQty = countedQty ?? firstLine.countedQty;
    reason = reason !== undefined ? reason : firstLine.reason;
    productName = firstLine.productName || '';
  }

  if (!productId && productName) {
    const product = await Product.findOne({ name: productName }).select('_id').lean();
    productId = product?._id;
  }

  return {
    productId,
    locationId,
    countedQty: Number(countedQty),
    reason,
  };
};

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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { reference: incomingRef, status: requestedStatus } = req.body;
    const payload = await resolveAdjustmentPayload(req.body);
    const { productId, locationId, countedQty, reason } = payload;

    if (!productId || !locationId || !Number.isFinite(countedQty)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'productId, locationId and countedQty are required' });
    }

    const allowedStatuses = ['draft', 'waiting', 'ready', 'done', 'cancelled'];
    const initialStatus = allowedStatuses.includes(requestedStatus) ? requestedStatus : 'draft';

    if (initialStatus !== 'draft' && req.user?.role !== 'manager') {
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: 'Only managers can set non-draft status' });
    }

    // Get current recorded qty
    const stockQuant = await StockQuant.findOne({ productId }).session(session);
    const recordedQty = stockQuant ? stockQuant.quantity : 0;
    const delta = countedQty - recordedQty;

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
          productId,
          locationId,
          recordedQty,
          countedQty,
          delta,
          reason: reason || '',
          status: initialStatus,
          createdBy: req.user._id,
        },
      ],
      { session }
    );

    if (initialStatus === 'done') {
      await applyAdjustmentDelta(session, adjustment, req.user._id);
    }

    await session.commitTransaction();

    const populated = await StockAdjustment.findById(adjustment._id)
      .populate('productId', 'name sku uom')
      .populate({
        path: 'locationId',
        populate: { path: 'warehouseId', select: 'name shortCode' },
      })
      .populate('createdBy', 'name email');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Update adjustment
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

    const { reference: incomingRef, status } = req.body;
    const payload = await resolveAdjustmentPayload(req.body);
    const { productId, locationId, countedQty, reason } = payload;

    const statusChanged = !!status && status !== adjustment.status;
    if (statusChanged && req.user?.role !== 'manager') {
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: 'Only managers can change status' });
    }

    if (['done', 'cancelled'].includes(adjustment.status)) {
      const hasNonStatusChange =
        (incomingRef && incomingRef.trim() && incomingRef.trim() !== adjustment.reference) ||
        !!productId ||
        !!locationId ||
        Number.isFinite(countedQty) ||
        reason !== '';

      if (hasNonStatusChange) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: `Cannot edit a ${adjustment.status} adjustment` });
      }
    }

    if (adjustment.status === 'done' && status && status !== 'done') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Cannot move a validated adjustment out of done state' });
    }

    if (incomingRef && incomingRef.trim() && incomingRef.trim() !== adjustment.reference) {
      const exists = await StockAdjustment.exists({ reference: incomingRef.trim() }).session(session);
      if (exists) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: 'Reference already exists' });
      }
      adjustment.reference = incomingRef.trim();
    }

    if (productId) adjustment.productId = productId;
    if (locationId) adjustment.locationId = locationId;
    if (Number.isFinite(countedQty)) adjustment.countedQty = countedQty;
    if (reason !== undefined) adjustment.reason = reason;

    if (productId || Number.isFinite(countedQty)) {
      const stockQuant = await StockQuant.findOne({ productId: adjustment.productId }).session(session);
      const recordedQty = stockQuant ? stockQuant.quantity : 0;
      adjustment.recordedQty = recordedQty;
      adjustment.delta = adjustment.countedQty - recordedQty;
    }

    const previousStatus = adjustment.status;
    if (status) adjustment.status = status;

    await adjustment.save({ session });

    if (previousStatus !== 'done' && adjustment.status === 'done') {
      await applyAdjustmentDelta(session, adjustment, req.user._id);
    }

    await session.commitTransaction();

    const populated = await StockAdjustment.findById(adjustment._id)
      .populate('productId', 'name sku uom')
      .populate({
        path: 'locationId',
        populate: { path: 'warehouseId', select: 'name shortCode' },
      })
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

    await applyAdjustmentDelta(session, adjustment, req.user._id);

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
