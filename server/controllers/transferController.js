const mongoose = require('mongoose');
const StockPicking = require('../models/StockPicking');
const StockMoveLine = require('../models/StockMoveLine');
const StockMove = require('../models/StockMove');
const StockQuant = require('../models/StockQuant');
const generateReference = require('../utils/generateReference');

/**
 * @desc    Get all transfers
 * @route   GET /api/transfers
 * @access  Private
 */
exports.getTransfers = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 25 } = req.query;

    const filter = { pickingType: 'INTERNAL' };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { reference: { $regex: search, $options: 'i' } },
        { sourceDocument: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await StockPicking.countDocuments(filter);
    const transfers = await StockPicking.find(filter)
      .populate('createdBy', 'name email')
      .sort('-createdAt')
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: transfers,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a transfer
 * @route   POST /api/transfers
 * @access  Private
 */
exports.createTransfer = async (req, res, next) => {
  try {
    const { scheduledDate, sourceDocument, notes, moveLines } = req.body;

    const reference = await generateReference('INTERNAL');

    const transfer = await StockPicking.create({
      reference,
      pickingType: 'INTERNAL',
      scheduledDate,
      sourceDocument,
      notes,
      status: 'draft',
      createdBy: req.user._id,
    });

    if (moveLines && moveLines.length > 0) {
      const lines = moveLines.map((line) => ({
        pickingId: transfer._id,
        productId: line.productId,
        description: line.description || '',
        qtyOrdered: line.qtyOrdered,
        qtyDone: line.qtyDone || 0,
        uom: line.uom || 'units',
        fromLocationId: line.fromLocationId,
        toLocationId: line.toLocationId,
        status: 'draft',
      }));
      await StockMoveLine.insertMany(lines);
    }

    const populatedTransfer = await StockPicking.findById(transfer._id)
      .populate('createdBy', 'name email')
      .populate({
        path: 'moveLines',
        populate: [
          { path: 'productId', select: 'name sku uom' },
          { path: 'fromLocationId', select: 'name shortCode' },
          { path: 'toLocationId', select: 'name shortCode' },
        ],
      });

    res.status(201).json({ success: true, data: populatedTransfer });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single transfer
 * @route   GET /api/transfers/:id
 * @access  Private
 */
exports.getTransfer = async (req, res, next) => {
  try {
    const transfer = await StockPicking.findOne({ _id: req.params.id, pickingType: 'INTERNAL' })
      .populate('createdBy', 'name email')
      .populate({
        path: 'moveLines',
        populate: [
          { path: 'productId', select: 'name sku uom' },
          { path: 'fromLocationId', select: 'name shortCode' },
          { path: 'toLocationId', select: 'name shortCode' },
        ],
      });

    if (!transfer) {
      return res.status(404).json({ success: false, message: 'Transfer not found' });
    }

    res.json({ success: true, data: transfer });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update transfer
 * @route   PUT /api/transfers/:id
 * @access  Private
 */
exports.updateTransfer = async (req, res, next) => {
  try {
    const transfer = await StockPicking.findOne({ _id: req.params.id, pickingType: 'INTERNAL' });

    if (!transfer) {
      return res.status(404).json({ success: false, message: 'Transfer not found' });
    }

    if (['done', 'cancelled'].includes(transfer.status)) {
      return res.status(400).json({ success: false, message: `Cannot edit a ${transfer.status} transfer` });
    }

    const { scheduledDate, sourceDocument, notes, status, moveLines } = req.body;

    if (scheduledDate !== undefined) transfer.scheduledDate = scheduledDate;
    if (sourceDocument !== undefined) transfer.sourceDocument = sourceDocument;
    if (notes !== undefined) transfer.notes = notes;
    if (status) transfer.status = status;

    await transfer.save();

    if (moveLines && moveLines.length > 0) {
      await StockMoveLine.deleteMany({ pickingId: transfer._id });
      const lines = moveLines.map((line) => ({
        pickingId: transfer._id,
        productId: line.productId,
        description: line.description || '',
        qtyOrdered: line.qtyOrdered,
        qtyDone: line.qtyDone || 0,
        uom: line.uom || 'units',
        fromLocationId: line.fromLocationId,
        toLocationId: line.toLocationId,
        status: transfer.status,
      }));
      await StockMoveLine.insertMany(lines);
    }

    const updatedTransfer = await StockPicking.findById(transfer._id)
      .populate('createdBy', 'name email')
      .populate({
        path: 'moveLines',
        populate: [
          { path: 'productId', select: 'name sku uom' },
          { path: 'fromLocationId', select: 'name shortCode' },
          { path: 'toLocationId', select: 'name shortCode' },
        ],
      });

    res.json({ success: true, data: updatedTransfer });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Validate transfer — move stock between locations (atomic)
 * @route   POST /api/transfers/:id/validate
 * @access  Private (Manager)
 */
exports.validateTransfer = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transfer = await StockPicking.findOne({ _id: req.params.id, pickingType: 'INTERNAL' }).session(session);

    if (!transfer) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Transfer not found' });
    }

    if (transfer.status === 'done') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Transfer is already validated' });
    }

    if (transfer.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Cannot validate a cancelled transfer' });
    }

    const moveLines = await StockMoveLine.find({ pickingId: transfer._id }).session(session);

    if (moveLines.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Transfer has no product lines' });
    }

    // Check availability
    for (const line of moveLines) {
      const qtyToTransfer = line.qtyDone > 0 ? line.qtyDone : line.qtyOrdered;

      const srcQuant = await StockQuant.findOne({
        productId: line.productId,
        locationId: line.fromLocationId,
      }).session(session);

      const available = srcQuant ? srcQuant.quantity : 0;

      if (available < qtyToTransfer) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock at source location. Available: ${available}, Required: ${qtyToTransfer}`,
        });
      }
    }

    // Process transfer lines
    for (const line of moveLines) {
      const qtyToTransfer = line.qtyDone > 0 ? line.qtyDone : line.qtyOrdered;

      // Decrease at source
      await StockQuant.findOneAndUpdate(
        { productId: line.productId, locationId: line.fromLocationId },
        { $inc: { quantity: -qtyToTransfer } },
        { session }
      );

      // Increase at destination
      await StockQuant.findOneAndUpdate(
        { productId: line.productId, locationId: line.toLocationId },
        { $inc: { quantity: qtyToTransfer } },
        { upsert: true, session }
      );

      // Ledger entry
      await StockMove.create(
        [
          {
            reference: transfer.reference,
            pickingId: transfer._id,
            productId: line.productId,
            fromLocationId: line.fromLocationId,
            toLocationId: line.toLocationId,
            quantity: qtyToTransfer,
            uom: line.uom,
            moveType: 'INTERNAL',
            status: 'done',
            createdBy: req.user._id,
          },
        ],
        { session }
      );

      line.qtyDone = qtyToTransfer;
      line.status = 'done';
      await line.save({ session });
    }

    transfer.status = 'done';
    await transfer.save({ session });

    await session.commitTransaction();

    const populatedTransfer = await StockPicking.findById(transfer._id)
      .populate('createdBy', 'name email')
      .populate({
        path: 'moveLines',
        populate: [
          { path: 'productId', select: 'name sku uom' },
          { path: 'fromLocationId', select: 'name shortCode' },
          { path: 'toLocationId', select: 'name shortCode' },
        ],
      });

    res.json({ success: true, message: 'Transfer validated successfully', data: populatedTransfer });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Cancel transfer
 * @route   POST /api/transfers/:id/cancel
 * @access  Private
 */
exports.cancelTransfer = async (req, res, next) => {
  try {
    const transfer = await StockPicking.findOne({ _id: req.params.id, pickingType: 'INTERNAL' });

    if (!transfer) {
      return res.status(404).json({ success: false, message: 'Transfer not found' });
    }

    if (transfer.status === 'done') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a completed transfer' });
    }

    transfer.status = 'cancelled';
    await transfer.save();

    await StockMoveLine.updateMany({ pickingId: transfer._id }, { status: 'cancelled' });

    res.json({ success: true, message: 'Transfer cancelled', data: transfer });
  } catch (error) {
    next(error);
  }
};
