const mongoose = require('mongoose');
const StockPicking = require('../models/StockPicking');
const StockMoveLine = require('../models/StockMoveLine');
const StockMove = require('../models/StockMove');
const StockQuant = require('../models/StockQuant');
const generateReference = require('../utils/generateReference');

const getLineQuantity = (line) => {
  const qtyDone = Number(line?.qtyDone || 0);
  const qtyOrdered = Number(line?.qtyOrdered || 0);
  return qtyDone > 0 ? qtyDone : qtyOrdered;
};

const aggregateQtyByProduct = (moveLines = []) => {
  const qtyByProduct = new Map();
  for (const line of moveLines) {
    const qty = getLineQuantity(line);
    const productId = line.productId?.toString();
    if (!productId || qty <= 0) continue;
    qtyByProduct.set(productId, (qtyByProduct.get(productId) || 0) + qty);
  }
  return qtyByProduct;
};

const reserveStockForLines = async (session, moveLines) => {
  const qtyByProduct = aggregateQtyByProduct(moveLines);

  for (const [productId, reserveQty] of qtyByProduct.entries()) {
    const quant = await StockQuant.findOne({ productId }).session(session);
    const availableQty = quant ? quant.quantity - quant.reservedQty : 0;

    if (availableQty < reserveQty) {
      throw new Error(`Insufficient stock to reserve. Available: ${availableQty}, Required: ${reserveQty}`);
    }
  }

  const ops = Array.from(qtyByProduct.entries()).map(([productId, reserveQty]) => ({
    updateOne: {
      filter: { productId },
      update: { $inc: { reservedQty: reserveQty } },
      upsert: true,
    },
  }));

  if (ops.length > 0) {
    await StockQuant.bulkWrite(ops, { session });
  }
};

const unreserveStockForLines = async (session, moveLines) => {
  const qtyByProduct = aggregateQtyByProduct(moveLines);

  for (const [productId, unreserveQty] of qtyByProduct.entries()) {
    const quant = await StockQuant.findOne({ productId }).session(session);
    const reservedQty = quant ? quant.reservedQty : 0;

    if (reservedQty < unreserveQty) {
      throw new Error(`Cannot release reservation. Reserved: ${reservedQty}, Required: ${unreserveQty}`);
    }
  }

  const ops = Array.from(qtyByProduct.entries()).map(([productId, unreserveQty]) => ({
    updateOne: {
      filter: { productId },
      update: { $inc: { reservedQty: -unreserveQty } },
    },
  }));

  if (ops.length > 0) {
    await StockQuant.bulkWrite(ops, { session });
  }
};

const consumeStockForLines = async (session, moveLines, fromReserved = false) => {
  const qtyByProduct = aggregateQtyByProduct(moveLines);

  for (const [productId, consumeQty] of qtyByProduct.entries()) {
    const quant = await StockQuant.findOne({ productId }).session(session);
    const quantity = quant ? quant.quantity : 0;
    const reservedQty = quant ? quant.reservedQty : 0;
    const availableQty = quantity - reservedQty;

    if (fromReserved) {
      if (reservedQty < consumeQty || quantity < consumeQty) {
        throw new Error(`Insufficient reserved stock. Reserved: ${reservedQty}, Quantity: ${quantity}, Required: ${consumeQty}`);
      }
      continue;
    }

    if (availableQty < consumeQty) {
      throw new Error(`Insufficient stock. Available: ${availableQty}, Required: ${consumeQty}`);
    }
  }

  const ops = Array.from(qtyByProduct.entries()).map(([productId, consumeQty]) => ({
    updateOne: {
      filter: { productId },
      update: fromReserved
        ? { $inc: { quantity: -consumeQty, reservedQty: -consumeQty } }
        : { $inc: { quantity: -consumeQty } },
    },
  }));

  if (ops.length > 0) {
    await StockQuant.bulkWrite(ops, { session });
  }
};

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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { reference: incomingRef, scheduledDate, notes, moveLines, status: requestedStatus } = req.body;
    const allowedStatuses = ['draft', 'waiting', 'ready', 'done', 'cancelled'];
    const initialStatus = allowedStatuses.includes(requestedStatus) ? requestedStatus : 'draft';
    const shouldReserve = initialStatus === 'ready';
    const shouldAutoPost = initialStatus === 'done';

    if (initialStatus !== 'draft' && req.user?.role !== 'manager') {
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: 'Only managers can set non-draft status' });
    }

    if (Array.isArray(moveLines) && moveLines.length > 0) {
      const hasInvalidLine = moveLines.some((line) => {
        const qtyOrdered = Number(line?.qtyOrdered || 0);
        return !line?.productId || !mongoose.Types.ObjectId.isValid(line.productId) || qtyOrdered <= 0;
      });

      if (hasInvalidLine) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Each move line must include a valid product and quantity greater than zero',
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
      reference = await generateReference('OUT');
    }

    const [delivery] = await StockPicking.create(
      [
        {
          reference,
          pickingType: 'OUT',
          scheduledDate,
          notes,
          status: initialStatus,
          isReturned: false,
          createdBy: req.user._id,
        },
      ],
      { session }
    );

    let createdLines = [];
    if (moveLines && moveLines.length > 0) {
      const lines = moveLines.map((line) => ({
        pickingId: delivery._id,
        productId: line.productId,
        qtyOrdered: line.qtyOrdered,
        qtyDone: line.qtyDone || 0,
        uom: line.uom || 'units',
        fromLocationId: line.fromLocationId,
        status: initialStatus,
      }));
      createdLines = await StockMoveLine.insertMany(lines, { session });
    }

    if (createdLines.length > 0 && shouldReserve) {
      try {
        await reserveStockForLines(session, createdLines);
      } catch (e) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: e.message });
      }

      await StockMoveLine.updateMany(
        { pickingId: delivery._id },
        { status: 'ready' },
        { session }
      );
    }

    // Auto-post newly created delivery quantities to stock when directly created as done.
    if (createdLines.length > 0 && shouldAutoPost) {
      try {
        await consumeStockForLines(session, createdLines, false);
      } catch (e) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: e.message });
      }

      for (const line of createdLines) {
        const qtyToDeliver = getLineQuantity(line);

        line.qtyDone = qtyToDeliver;
        line.status = 'done';
        await line.save({ session });

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
      }
    }

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

    res.status(201).json({ success: true, data: populatedDelivery });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const delivery = await StockPicking.findOne({ _id: req.params.id, pickingType: 'OUT' }).session(session);

    if (!delivery) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Delivery not found' });
    }

    if (delivery.isReturned) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Return already processed. Delivery is immutable' });
    }

    if (delivery.isReturned) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Returned delivery is immutable' });
    }

    if (delivery.isReturned) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Returned delivery is immutable' });
    }

    const { reference: incomingRef, scheduledDate, notes, status, moveLines } = req.body;
    const previousStatus = delivery.status;
    const nextStatus = status || previousStatus;
    const allowedStatuses = ['draft', 'waiting', 'ready', 'done', 'cancelled'];

    if (!allowedStatuses.includes(nextStatus)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const statusChanged = nextStatus !== previousStatus;

    if (statusChanged && req.user?.role !== 'manager') {
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: 'Only managers can change status' });
    }

    if (['done', 'cancelled'].includes(previousStatus)) {
      const hasNonStatusChange =
        (incomingRef && incomingRef.trim() && incomingRef.trim() !== delivery.reference) ||
        scheduledDate !== undefined ||
        notes !== undefined ||
        (Array.isArray(moveLines) && moveLines.length > 0);

      if (hasNonStatusChange) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: `Cannot edit a ${delivery.status} delivery` });
      }
    }

    if (previousStatus === 'ready' && Array.isArray(moveLines) && moveLines.length > 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Move status back to draft/waiting before editing reserved lines' });
    }

    if (Array.isArray(moveLines) && moveLines.length > 0) {
      const hasInvalidLine = moveLines.some((line) => {
        const qtyOrdered = Number(line?.qtyOrdered || 0);
        return !line?.productId || !mongoose.Types.ObjectId.isValid(line.productId) || qtyOrdered <= 0;
      });

      if (hasInvalidLine) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Each move line must include a valid product and quantity greater than zero',
        });
      }
    }

    if (incomingRef && incomingRef.trim() && incomingRef.trim() !== delivery.reference) {
      const exists = await StockPicking.exists({ reference: incomingRef.trim() }).session(session);
      if (exists) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: 'Reference already exists' });
      }
      delivery.reference = incomingRef.trim();
    }

    if (scheduledDate !== undefined) delivery.scheduledDate = scheduledDate;
    if (notes !== undefined) delivery.notes = notes;
    delivery.status = nextStatus;

    await delivery.save({ session });

    if (moveLines && moveLines.length > 0) {
      await StockMoveLine.deleteMany({ pickingId: delivery._id }).session(session);
      const lines = moveLines.map((line) => ({
        pickingId: delivery._id,
        productId: line.productId,
        qtyOrdered: line.qtyOrdered,
        qtyDone: line.qtyDone || 0,
        uom: line.uom || 'units',
        fromLocationId: line.fromLocationId,
        status: nextStatus,
      }));
      await StockMoveLine.insertMany(lines, { session });
    }

    const persistedLines = await StockMoveLine.find({ pickingId: delivery._id }).session(session);

    if (statusChanged) {
      if (nextStatus === 'ready' && previousStatus !== 'ready') {
        try {
          await reserveStockForLines(session, persistedLines);
        } catch (e) {
          await session.abortTransaction();
          return res.status(400).json({ success: false, message: e.message });
        }
      }

      if (nextStatus === 'done') {
        try {
          await consumeStockForLines(session, persistedLines, previousStatus === 'ready');
        } catch (e) {
          await session.abortTransaction();
          return res.status(400).json({ success: false, message: e.message });
        }

        for (const line of persistedLines) {
          const qtyToDeliver = getLineQuantity(line);
          line.qtyDone = qtyToDeliver;
          line.status = 'done';
          await line.save({ session });

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
        }
      } else {
        if (previousStatus === 'ready') {
          try {
            await unreserveStockForLines(session, persistedLines);
          } catch (e) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: e.message });
          }
        }

        await StockMoveLine.updateMany(
          { pickingId: delivery._id },
          { status: nextStatus, ...(nextStatus !== 'done' ? { qtyDone: 0 } : {}) },
          { session }
        );
      }
    }

    await session.commitTransaction();

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
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
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

    try {
      await consumeStockForLines(session, moveLines, delivery.status === 'ready');
    } catch (e) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: e.message });
    }

    // Process each move line — finalize and emit stock move records
    for (const line of moveLines) {
      const qtyToDeliver = getLineQuantity(line);

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

    delivery.isReturned = true;
    delivery.returnedAt = new Date();
    delivery.status = 'cancelled';
    await delivery.save({ session });

    await session.commitTransaction();
    res.json({ success: true, message: 'Delivery returned successfully', data: { returnReference: returnRef } });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
