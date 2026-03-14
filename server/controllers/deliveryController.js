const mongoose = require('mongoose');
const StockPicking = require('../models/StockPicking');
const StockMoveLine = require('../models/StockMoveLine');
const StockMove = require('../models/StockMove');
const StockQuant = require('../models/StockQuant');
const generateReference = require('../utils/generateReference');

/**
 * @desc    Get all deliveries
 * @route   GET /api/deliveries
 * @access  Private
 */
exports.getDeliveries = async (req, res, next) => {
  try {
    const { status, search, dateFrom, dateTo, page = 1, limit = 25 } = req.query;

    const filter = { pickingType: 'OUT' };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { reference: { $regex: search, $options: 'i' } },
        { supplierOrCustomer: { $regex: search, $options: 'i' } },
        { sourceDocument: { $regex: search, $options: 'i' } },
      ];
    }
    if (dateFrom || dateTo) {
      filter.scheduledDate = {};
      if (dateFrom) filter.scheduledDate.$gte = new Date(dateFrom);
      if (dateTo) filter.scheduledDate.$lte = new Date(dateTo);
    }

    const total = await StockPicking.countDocuments(filter);
    const deliveries = await StockPicking.find(filter)
      .populate('createdBy', 'name email')
      .sort('-createdAt')
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: deliveries,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a delivery order
 * @route   POST /api/deliveries
 * @access  Private
 */
exports.createDelivery = async (req, res, next) => {
  try {
    const { reference: incomingRef, supplierOrCustomer, scheduledDate, sourceDocument, notes, moveLines } = req.body;

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
      reference = await generateReference('OUT');
    }

    const delivery = await StockPicking.create({
      reference,
      pickingType: 'OUT',
      supplierOrCustomer,
      scheduledDate,
      sourceDocument,
      notes,
      status: 'draft',
      createdBy: req.user._id,
    });

    if (moveLines && moveLines.length > 0) {
      const lines = moveLines.map((line) => ({
        pickingId: delivery._id,
        productId: line.productId,
        qtyOrdered: line.qtyOrdered,
        qtyDone: line.qtyDone || 0,
        uom: line.uom || 'units',
        fromLocationId: line.fromLocationId,
        status: 'draft',
      }));
      await StockMoveLine.insertMany(lines);
    }

    const populatedDelivery = await StockPicking.findById(delivery._id)
      .populate('createdBy', 'name email')
      .populate({
        path: 'moveLines',
        populate: [
          { path: 'productId', select: 'name sku uom' },
          { path: 'fromLocationId', select: 'name shortCode' },
        ],
      });

    res.status(201).json({ success: true, data: populatedDelivery });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single delivery
 * @route   GET /api/deliveries/:id
 * @access  Private
 */
exports.getDelivery = async (req, res, next) => {
  try {
    const delivery = await StockPicking.findOne({ _id: req.params.id, pickingType: 'OUT' })
      .populate('createdBy', 'name email')
      .populate({
        path: 'moveLines',
        populate: [
          { path: 'productId', select: 'name sku uom' },
          { path: 'fromLocationId', select: 'name shortCode' },
        ],
      });

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Delivery not found' });
    }

    res.json({ success: true, data: delivery });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update delivery (only draft/waiting)
 * @route   PUT /api/deliveries/:id
 * @access  Private
 */
exports.updateDelivery = async (req, res, next) => {
  try {
    const delivery = await StockPicking.findOne({ _id: req.params.id, pickingType: 'OUT' });

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Delivery not found' });
    }

    if (['done', 'cancelled'].includes(delivery.status)) {
      return res.status(400).json({ success: false, message: `Cannot edit a ${delivery.status} delivery` });
    }

    const { reference: incomingRef, supplierOrCustomer, scheduledDate, sourceDocument, notes, status, moveLines } = req.body;

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

    if (incomingRef && incomingRef.trim() && incomingRef.trim() !== delivery.reference) {
      const exists = await StockPicking.exists({ reference: incomingRef.trim() });
      if (exists) {
        return res.status(400).json({ success: false, message: 'Reference already exists' });
      }
      delivery.reference = incomingRef.trim();
    }

    if (supplierOrCustomer !== undefined) delivery.supplierOrCustomer = supplierOrCustomer;
    if (scheduledDate !== undefined) delivery.scheduledDate = scheduledDate;
    if (sourceDocument !== undefined) delivery.sourceDocument = sourceDocument;
    if (notes !== undefined) delivery.notes = notes;
    if (status) delivery.status = status;

    await delivery.save();

    if (moveLines && moveLines.length > 0) {
      await StockMoveLine.deleteMany({ pickingId: delivery._id });
      const lines = moveLines.map((line) => ({
        pickingId: delivery._id,
        productId: line.productId,
        qtyOrdered: line.qtyOrdered,
        qtyDone: line.qtyDone || 0,
        uom: line.uom || 'units',
        fromLocationId: line.fromLocationId,
        status: delivery.status,
      }));
      await StockMoveLine.insertMany(lines);
    }

    const updatedDelivery = await StockPicking.findById(delivery._id)
      .populate('createdBy', 'name email')
      .populate({
        path: 'moveLines',
        populate: [
          { path: 'productId', select: 'name sku uom' },
          { path: 'fromLocationId', select: 'name shortCode' },
        ],
      });

    res.json({ success: true, data: updatedDelivery });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Validate delivery (Ready → Done) — decreases stock
 * @route   POST /api/deliveries/:id/validate
 * @access  Private (Manager)
 */
exports.validateDelivery = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const delivery = await StockPicking.findOne({ _id: req.params.id, pickingType: 'OUT' }).session(session);

    if (!delivery) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Delivery not found' });
    }

    if (delivery.status === 'done') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Delivery is already validated' });
    }

    if (delivery.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Cannot validate a cancelled delivery' });
    }

    const moveLines = await StockMoveLine.find({ pickingId: delivery._id }).session(session);

    if (moveLines.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Delivery has no product lines' });
    }

    // Check availability for all lines first
    for (const line of moveLines) {
      const qtyToDeliver = line.qtyDone > 0 ? line.qtyDone : line.qtyOrdered;

      const stockQuant = await StockQuant.findOne({
        productId: line.productId,
      }).session(session);

      const availableQty = stockQuant ? stockQuant.quantity - stockQuant.reservedQty : 0;

      if (availableQty < qtyToDeliver) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product at source location. Available: ${availableQty}, Required: ${qtyToDeliver}`,
        });
      }
    }

    // Process each move line — decrease stock at source location
    for (const line of moveLines) {
      const qtyToDeliver = line.qtyDone > 0 ? line.qtyDone : line.qtyOrdered;

      await StockQuant.findOneAndUpdate(
        { productId: line.productId },
        { $inc: { quantity: -qtyToDeliver } },
        { session }
      );

      await StockMove.create(
        [
          {
            reference: delivery.reference,
            pickingId: delivery._id,
            productId: line.productId,
            fromLocationId: line.fromLocationId,
            quantity: qtyToDeliver,
            uom: line.uom,
            moveType: 'OUT',
            status: 'done',
            createdBy: req.user._id,
          },
        ],
        { session }
      );

      line.qtyDone = qtyToDeliver;
      line.status = 'done';
      await line.save({ session });
    }

    delivery.status = 'done';
    await delivery.save({ session });

    await session.commitTransaction();

    const populatedDelivery = await StockPicking.findById(delivery._id)
      .populate('createdBy', 'name email')
      .populate({
        path: 'moveLines',
        populate: [
          { path: 'productId', select: 'name sku uom' },
          { path: 'fromLocationId', select: 'name shortCode' },
        ],
      });

    res.json({ success: true, message: 'Delivery validated successfully', data: populatedDelivery });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Cancel delivery
 * @route   POST /api/deliveries/:id/cancel
 * @access  Private
 */
exports.cancelDelivery = async (req, res, next) => {
  try {
    const delivery = await StockPicking.findOne({ _id: req.params.id, pickingType: 'OUT' });

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Delivery not found' });
    }

    if (delivery.status === 'done') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a completed delivery' });
    }

    delivery.status = 'cancelled';
    await delivery.save();

    await StockMoveLine.updateMany({ pickingId: delivery._id }, { status: 'cancelled' });

    res.json({ success: true, message: 'Delivery cancelled', data: delivery });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Return delivery (reverse stock — re-add to inventory)
 * @route   POST /api/deliveries/:id/return
 * @access  Private (Manager)
 */
exports.returnDelivery = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const delivery = await StockPicking.findOne({ _id: req.params.id, pickingType: 'OUT' }).session(session);

    if (!delivery) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Delivery not found' });
    }

    if (delivery.status !== 'done') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Can only return a completed delivery' });
    }

    const moveLines = await StockMoveLine.find({ pickingId: delivery._id }).session(session);

    const returnRef = await generateReference('IN');
    const returnPicking = await StockPicking.create(
      [
        {
          reference: returnRef,
          pickingType: 'IN',
          supplierOrCustomer: delivery.supplierOrCustomer,
          sourceDocument: delivery.reference,
          status: 'done',
          notes: `Return for ${delivery.reference}`,
          createdBy: req.user._id,
        },
      ],
      { session }
    );

    for (const line of moveLines) {
      // Re-add stock
      await StockQuant.findOneAndUpdate(
        { productId: line.productId },
        { $inc: { quantity: line.qtyDone } },
        { upsert: true, session }
      );

      await StockMove.create(
        [
          {
            reference: returnRef,
            pickingId: returnPicking[0]._id,
            productId: line.productId,
            toLocationId: line.fromLocationId,
            quantity: line.qtyDone,
            uom: line.uom,
            moveType: 'IN',
            status: 'done',
            createdBy: req.user._id,
          },
        ],
        { session }
      );
    }

    await session.commitTransaction();
    res.json({ success: true, message: 'Delivery returned successfully', data: { returnReference: returnRef } });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
