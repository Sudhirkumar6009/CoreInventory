const mongoose = require('mongoose');
const StockPicking = require('../models/StockPicking');
const StockMoveLine = require('../models/StockMoveLine');
const StockMove = require('../models/StockMove');
const StockQuant = require('../models/StockQuant');
const generateReference = require('../utils/generateReference');

/**
 * @desc    Get all receipts
 * @route   GET /api/receipts
 * @access  Private
 */
exports.getReceipts = async (req, res, next) => {
  try {
    const { status, search, dateFrom, dateTo, page = 1, limit = 25 } = req.query;

    const filter = { pickingType: 'IN' };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { reference: { $regex: search, $options: 'i' } },
        { sourceDocument: { $regex: search, $options: 'i' } },
      ];
    }
    if (dateFrom || dateTo) {
      filter.scheduledDate = {};
      if (dateFrom) filter.scheduledDate.$gte = new Date(dateFrom);
      if (dateTo) filter.scheduledDate.$lte = new Date(dateTo);
    }

    const total = await StockPicking.countDocuments(filter);
    const receipts = await StockPicking.find(filter)
      .populate('createdBy', 'name email')
      .sort('-createdAt')
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const normalizedReceipts = receipts.map((receipt) => ({
      ...receipt,
      responsibleUserEmail: receipt.createdBy?.email || '',
    }));

    res.json({
      success: true,
      data: normalizedReceipts,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a receipt
 * @route   POST /api/receipts
 * @access  Private
 */
exports.createReceipt = async (req, res, next) => {
  try {
    const { reference: incomingRef, scheduledDate, sourceDocument, notes, moveLines } = req.body;

    if (Array.isArray(moveLines) && moveLines.length > 0) {
      const hasInvalidLine = moveLines.some((line) => {
        const qtyOrdered = Number(line?.qtyOrdered || 0);
        return !line?.productId || !mongoose.Types.ObjectId.isValid(line.productId) || qtyOrdered <= 0;
      });

      if (hasInvalidLine) {
        return res.status(400).json({
          success: false,
          message: 'Each move line must include a valid product and quantity greater than zero',
        });
      }
    }

    let reference = incomingRef?.trim();
    if (reference) {
      const exists = await StockPicking.exists({ reference });
      if (exists) {
        return res.status(400).json({ success: false, message: 'Reference already exists' });
      }
    } else {
      reference = await generateReference('IN');
    }

    const receipt = await StockPicking.create({
      reference,
      pickingType: 'IN',
      scheduledDate,
      sourceDocument,
      notes,
      status: 'draft',
      createdBy: req.user._id,
    });

    // Create move lines
    if (moveLines && moveLines.length > 0) {
      const lines = moveLines.map((line) => ({
        pickingId: receipt._id,
        productId: line.productId,
        qtyOrdered: line.qtyOrdered,
        qtyDone: line.qtyDone || 0,
        uom: line.uom || 'units',
        toLocationId: line.toLocationId,
        status: 'draft',
      }));
      await StockMoveLine.insertMany(lines);
    }

    const populatedReceipt = await StockPicking.findById(receipt._id)
      .populate('createdBy', 'name email')
      .populate({
        path: 'moveLines',
        populate: [
          { path: 'productId', select: 'name sku uom' },
          { path: 'toLocationId', select: 'name shortCode' },
        ],
      });

    const createdReceipt = populatedReceipt.toObject();
    createdReceipt.responsibleUserEmail = createdReceipt.createdBy?.email || '';

    res.status(201).json({ success: true, data: createdReceipt });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single receipt
 * @route   GET /api/receipts/:id
 * @access  Private
 */
exports.getReceipt = async (req, res, next) => {
  try {
    const receipt = await StockPicking.findOne({ _id: req.params.id, pickingType: 'IN' })
      .populate('createdBy', 'name email')
      .populate({
        path: 'moveLines',
        populate: [
          { path: 'productId', select: 'name sku uom' },
          { path: 'toLocationId', select: 'name shortCode' },
        ],
      });

    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    const receiptData = receipt.toObject();
    receiptData.responsibleUserEmail = receiptData.createdBy?.email || '';

    res.json({ success: true, data: receiptData });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update receipt (only draft/waiting)
 * @route   PUT /api/receipts/:id
 * @access  Private
 */
exports.updateReceipt = async (req, res, next) => {
  try {
    const receipt = await StockPicking.findOne({ _id: req.params.id, pickingType: 'IN' });

    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    if (receipt.status === 'done') {
      return res.status(400).json({ success: false, message: 'Cannot edit a completed receipt' });
    }

    if (receipt.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot edit a cancelled receipt' });
    }

    const { reference: incomingRef, scheduledDate, sourceDocument, notes, status, moveLines } = req.body;

    if (Array.isArray(moveLines) && moveLines.length > 0) {
      const hasInvalidLine = moveLines.some((line) => {
        const qtyOrdered = Number(line?.qtyOrdered || 0);
        return !line?.productId || !mongoose.Types.ObjectId.isValid(line.productId) || qtyOrdered <= 0;
      });

      if (hasInvalidLine) {
        return res.status(400).json({
          success: false,
          message: 'Each move line must include a valid product and quantity greater than zero',
        });
      }
    }

    if (incomingRef && incomingRef.trim() && incomingRef.trim() !== receipt.reference) {
      const exists = await StockPicking.exists({ reference: incomingRef.trim() });
      if (exists) {
        return res.status(400).json({ success: false, message: 'Reference already exists' });
      }
      receipt.reference = incomingRef.trim();
    }

    if (scheduledDate !== undefined) receipt.scheduledDate = scheduledDate;
    if (sourceDocument !== undefined) receipt.sourceDocument = sourceDocument;
    if (notes !== undefined) receipt.notes = notes;
    if (status) receipt.status = status;

    await receipt.save();

    // Update move lines if provided
    if (moveLines && moveLines.length > 0) {
      // Remove existing lines and re-create
      await StockMoveLine.deleteMany({ pickingId: receipt._id });
      const lines = moveLines.map((line) => ({
        pickingId: receipt._id,
        productId: line.productId,
        qtyOrdered: line.qtyOrdered,
        qtyDone: line.qtyDone || 0,
        uom: line.uom || 'units',
        toLocationId: line.toLocationId,
        status: receipt.status,
      }));
      await StockMoveLine.insertMany(lines);
    }

    const updatedReceipt = await StockPicking.findById(receipt._id)
      .populate('createdBy', 'name email')
      .populate({
        path: 'moveLines',
        populate: [
          { path: 'productId', select: 'name sku uom' },
          { path: 'toLocationId', select: 'name shortCode' },
        ],
      });

    const updatedReceiptData = updatedReceipt.toObject();
    updatedReceiptData.responsibleUserEmail = updatedReceiptData.createdBy?.email || '';

    res.json({ success: true, data: updatedReceiptData });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Validate receipt (Ready → Done) — increases stock
 * @route   POST /api/receipts/:id/validate
 * @access  Private (Manager)
 */
exports.validateReceipt = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const receipt = await StockPicking.findOne({ _id: req.params.id, pickingType: 'IN' }).session(session);

    if (!receipt) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    if (receipt.status === 'done') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Receipt is already validated' });
    }

    if (receipt.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Cannot validate a cancelled receipt' });
    }

    const moveLines = await StockMoveLine.find({ pickingId: receipt._id }).session(session);

    if (moveLines.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Receipt has no product lines' });
    }

    // Process each move line — increase stock at destination location
    for (const line of moveLines) {
      const qtyToReceive = line.qtyDone > 0 ? line.qtyDone : line.qtyOrdered;

      // Update or create stock quant
      await StockQuant.findOneAndUpdate(
        { productId: line.productId },
        { $inc: { quantity: qtyToReceive } },
        { upsert: true, session }
      );

      // Create immutable stock move record
      await StockMove.create(
        [
          {
            reference: receipt.reference,
            pickingId: receipt._id,
            productId: line.productId,
            toLocationId: line.toLocationId,
            quantity: qtyToReceive,
            uom: line.uom,
            moveType: 'IN',
            status: 'done',
            createdBy: req.user._id,
          },
        ],
        { session }
      );

      // Update line status
      line.qtyDone = qtyToReceive;
      line.status = 'done';
      await line.save({ session });
    }

    receipt.status = 'done';
    await receipt.save({ session });

    await session.commitTransaction();

    const populatedReceipt = await StockPicking.findById(receipt._id)
      .populate('createdBy', 'name email')
      .populate({
        path: 'moveLines',
        populate: [
          { path: 'productId', select: 'name sku uom' },
          { path: 'toLocationId', select: 'name shortCode' },
        ],
      });

    const validatedReceipt = populatedReceipt.toObject();
    validatedReceipt.responsibleUserEmail = validatedReceipt.createdBy?.email || '';

    res.json({ success: true, message: 'Receipt validated successfully', data: validatedReceipt });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Cancel receipt
 * @route   POST /api/receipts/:id/cancel
 * @access  Private
 */
exports.cancelReceipt = async (req, res, next) => {
  try {
    const receipt = await StockPicking.findOne({ _id: req.params.id, pickingType: 'IN' });

    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    if (receipt.status === 'done') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a completed receipt' });
    }

    receipt.status = 'cancelled';
    await receipt.save();

    await StockMoveLine.updateMany({ pickingId: receipt._id }, { status: 'cancelled' });

    res.json({ success: true, message: 'Receipt cancelled', data: receipt });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Return receipt (reverse stock)
 * @route   POST /api/receipts/:id/return
 * @access  Private (Manager)
 */
exports.returnReceipt = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const receipt = await StockPicking.findOne({ _id: req.params.id, pickingType: 'IN' }).session(session);

    if (!receipt) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    if (receipt.status !== 'done') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Can only return a completed receipt' });
    }

    const moveLines = await StockMoveLine.find({ pickingId: receipt._id }).session(session);

    // Create a return picking
    const returnRef = await generateReference('OUT');
    const returnPicking = await StockPicking.create(
      [
        {
          reference: returnRef,
          pickingType: 'OUT',
          supplierOrCustomer: receipt.supplierOrCustomer,
          sourceDocument: receipt.reference,
          status: 'done',
          notes: `Return for ${receipt.reference}`,
          createdBy: req.user._id,
        },
      ],
      { session }
    );

    for (const line of moveLines) {
      // Decrease stock
      await StockQuant.findOneAndUpdate(
        { productId: line.productId },
        { $inc: { quantity: -line.qtyDone } },
        { session }
      );

      // Create return move record
      await StockMove.create(
        [
          {
            reference: returnRef,
            pickingId: returnPicking[0]._id,
            productId: line.productId,
            fromLocationId: line.toLocationId,
            quantity: line.qtyDone,
            uom: line.uom,
            moveType: 'OUT',
            status: 'done',
            createdBy: req.user._id,
          },
        ],
        { session }
      );
    }

    await session.commitTransaction();
    res.json({ success: true, message: 'Receipt returned successfully', data: { returnReference: returnRef } });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
