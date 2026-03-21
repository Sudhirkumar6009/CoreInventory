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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { reference: incomingRef, scheduledDate, notes, moveLines, status: requestedStatus, destinationLocation, supplierOrCustomer } = req.body;
    const allowedStatuses = ['draft', 'waiting', 'ready', 'done', 'cancelled'];
    const initialStatus = allowedStatuses.includes(requestedStatus) ? requestedStatus : 'draft';
    const shouldAutoPost = initialStatus === 'done';

    const staffLocationId = req.user?.role === 'staff' ? req.user.locationId : null;

    if (initialStatus !== 'draft' && req.user?.role !== 'manager') {
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: 'Only managers can set non-draft status' });
    }

    if (Array.isArray(moveLines) && moveLines.length > 0) {
      const hasInvalidLine = moveLines.some((line) => {
        const qtyOrdered = Number(line?.qtyOrdered || 0);
        const locId = staffLocationId || line.toLocationId || destinationLocation;
        return !line?.productId || !mongoose.Types.ObjectId.isValid(line.productId) || qtyOrdered <= 0 || !locId || !mongoose.Types.ObjectId.isValid(locId);
      });

      if (hasInvalidLine) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Each move line must include a valid product, valid location, and quantity greater than zero',
        });
      }
    }

    let reference = incomingRef?.trim();
    if (reference) {
      const exists = await StockPicking.exists({ reference }).session(session);
      if (exists) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: 'Reference already exists' });
      }
    } else {
      reference = await generateReference('IN');
    }

    const [receipt] = await StockPicking.create(
      [
        {
          reference,
          pickingType: 'IN',
          supplierOrCustomer: supplierOrCustomer?.trim() || "",
          scheduledDate,
          notes,
          status: initialStatus,
          createdBy: req.user._id,
        },
      ],
      { session }
    );

    // Create move lines
    let createdLines = [];
    if (moveLines && moveLines.length > 0) {
      const lines = moveLines.map((line) => ({
        pickingId: receipt._id,
        productId: line.productId,
        qtyOrdered: line.qtyOrdered,
        qtyDone: line.qtyDone || 0,
        uom: line.uom || 'units',
        toLocationId: staffLocationId || line.toLocationId || destinationLocation,
        status: initialStatus,
      }));
      createdLines = await StockMoveLine.insertMany(lines, { session });
    }

    // Auto-post newly created receipt quantities to stock for consistency.
    if (createdLines.length > 0 && shouldAutoPost) {
      const qtyByProductAndLocation = new Map();

      for (const line of createdLines) {
        const qtyToReceive = line.qtyDone > 0 ? line.qtyDone : line.qtyOrdered;
        const productId = line.productId.toString();
        const locationId = line.toLocationId.toString();
        const key = `${productId}_${locationId}`;
        qtyByProductAndLocation.set(key, (qtyByProductAndLocation.get(key) || 0) + qtyToReceive);

        line.qtyDone = qtyToReceive;
        line.status = 'done';
        await line.save({ session });

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
      }

      const quantOps = Array.from(qtyByProductAndLocation.entries()).map(([key, quantity]) => {
        const [productId, locationId] = key.split('_');
        return {
          updateOne: {
            filter: { productId, locationId },
            update: { $inc: { quantity } },
            upsert: true,
          },
        };
      });

      if (quantOps.length > 0) {
        await StockQuant.bulkWrite(quantOps, { session });
      }
    }

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

    const createdReceipt = populatedReceipt.toObject();
    createdReceipt.responsibleUserEmail = createdReceipt.createdBy?.email || '';

    res.status(201).json({ success: true, data: createdReceipt });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const receipt = await StockPicking.findOne({ _id: req.params.id, pickingType: 'IN' }).session(session);

    if (!receipt) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    const { reference: incomingRef, scheduledDate, notes, status, moveLines, destinationLocation, supplierOrCustomer } = req.body;

    const staffLocationId = req.user?.role === 'staff' ? req.user.locationId : null;
    const previousStatus = receipt.status;
    const isBecomingDone = previousStatus !== 'done' && status === 'done';
    const statusChanged = !!status && status !== previousStatus;

    if (statusChanged && req.user?.role !== 'manager') {
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: 'Only managers can change status' });
    }

    if (['done', 'cancelled'].includes(receipt.status)) {
      const hasNonStatusChange =
        (incomingRef && incomingRef.trim() && incomingRef.trim() !== receipt.reference) ||
        scheduledDate !== undefined ||
        notes !== undefined ||
        supplierOrCustomer !== undefined ||
        (Array.isArray(moveLines) && moveLines.length > 0) ||
        (destinationLocation !== undefined && destinationLocation !== receipt.destinationLocation?.toString());

      if (hasNonStatusChange) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: `Cannot edit a ${receipt.status} receipt` });
      }
    }

    if (Array.isArray(moveLines) && moveLines.length > 0) {
      const hasInvalidLine = moveLines.some((line) => {
        const qtyOrdered = Number(line?.qtyOrdered || 0);
        const locId = staffLocationId || line.toLocationId || destinationLocation;
        return !line?.productId || !mongoose.Types.ObjectId.isValid(line.productId) || qtyOrdered <= 0 || !locId || !mongoose.Types.ObjectId.isValid(locId);
      });

      if (hasInvalidLine) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Each move line must include a valid product, valid location, and quantity greater than zero',
        });
      }
    }

    if (incomingRef && incomingRef.trim() && incomingRef.trim() !== receipt.reference) {
      const exists = await StockPicking.exists({ reference: incomingRef.trim() }).session(session);
      if (exists) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: 'Reference already exists' });
      }
      receipt.reference = incomingRef.trim();
    }

    if (scheduledDate !== undefined) receipt.scheduledDate = scheduledDate;
    if (notes !== undefined) receipt.notes = notes;
    if (supplierOrCustomer !== undefined) receipt.supplierOrCustomer = supplierOrCustomer.trim();
    if (status) receipt.status = status;
    if (staffLocationId || destinationLocation !== undefined) receipt.destinationLocation = staffLocationId || destinationLocation;

    await receipt.save({ session });

    let finalLines = [];
    if (moveLines && moveLines.length > 0) {
      await StockMoveLine.deleteMany({ pickingId: receipt._id }).session(session);
      const lines = moveLines.map((line) => ({
        pickingId: receipt._id,
        productId: line.productId,
        qtyOrdered: line.qtyOrdered,
        qtyDone: line.qtyDone || 0,
        uom: line.uom || 'units',
        toLocationId: staffLocationId || line.toLocationId || destinationLocation,
        status: receipt.status,
      }));
      finalLines = await StockMoveLine.insertMany(lines, { session });
    } else {
      finalLines = await StockMoveLine.find({ pickingId: receipt._id }).session(session);
    }

    if (isBecomingDone) {
      if (finalLines.length === 0) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: 'Receipt has no product lines' });
      }

      for (const line of finalLines) {
        const qtyToReceive = line.qtyDone > 0 ? line.qtyDone : line.qtyOrdered;
        await StockQuant.findOneAndUpdate(
          { productId: line.productId, locationId: line.toLocationId },
          { $inc: { quantity: qtyToReceive } },
          { upsert: true, session }
        );
        await StockMove.create(
          [{
            reference: receipt.reference,
            pickingId: receipt._id,
            productId: line.productId,
            toLocationId: line.toLocationId,
            quantity: qtyToReceive,
            uom: line.uom,
            moveType: 'IN',
            status: 'done',
            createdBy: req.user._id,
          }],
          { session }
        );
        line.qtyDone = qtyToReceive;
        line.status = 'done';
        await line.save({ session });
      }
    }

    await session.commitTransaction();

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


