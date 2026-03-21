const mongoose = require("mongoose");
const StockPicking = require("../models/StockPicking");
const StockMoveLine = require("../models/StockMoveLine");
const StockMove = require("../models/StockMove");
const StockQuant = require("../models/StockQuant");
const Location = require("../models/Location");
const User = require("../models/User");
const generateReference = require("../utils/generateReference");

const isStaffUser = (user) => user?.role === "staff";

const ensureStaffLocationScope = (sourceLocation, destinationLocation, user) => {
  if (!isStaffUser(user)) return { ok: true };

  const staffLoc = String(user.locationId);
  const src = String(sourceLocation);
  const dst = String(destinationLocation);

  if (src !== staffLoc && dst !== staffLoc) {
    return { ok: false, message: "Staff transfers must involve their assigned location as either source or destination" };
  }

  return { ok: true };
};

const getStaffUserIds = async () => {
  const staffUsers = await User.find({ role: "staff" }).select("_id").lean();
  return staffUsers.map((u) => u._id);
};

const getTransferScopeFilter = (req, extra = {}) => {
  const filter = { pickingType: "INTERNAL", ...extra };
  if (isStaffUser(req.user)) {
    filter.createdBy = req.user._id;
  } else if (req.user?.role === "manager") {
    filter.createdByRole = { $ne: "staff" };
  }
  return filter;
};

const collectEffectiveLocationIds = (
  moveLines = [],
  fallbackSource,
  fallbackDestination,
) => {
  const ids = new Set();

  if (fallbackSource) ids.add(String(fallbackSource));
  if (fallbackDestination) ids.add(String(fallbackDestination));

  for (const line of moveLines) {
    const fromId = line?.fromLocationId || fallbackSource;
    const toId = line?.toLocationId || fallbackDestination;
    if (fromId) ids.add(String(fromId));
    if (toId) ids.add(String(toId));
  }

  return Array.from(ids);
};

const validateLocationIdsExist = async (locationIds = []) => {
  if (!locationIds.length) return true;
  const existing = await Location.countDocuments({ _id: { $in: locationIds } });
  return existing === locationIds.length;
};

// ── Stock reservation helpers (mirrors deliveryController) ──

const aggregateQtyByProductAndLocation = (moveLines) => {
  const qtyMap = new Map();
  for (const line of moveLines) {
    const productId = String(line.productId?._id || line.productId || '');
    const locationId = String(line.fromLocationId?._id || line.fromLocationId || '');
    const qty = Number(line.qtyDone > 0 ? line.qtyDone : line.qtyOrdered) || 0;
    if (!productId || !locationId || qty <= 0) continue;
    const key = `${productId}_${locationId}`;
    qtyMap.set(key, (qtyMap.get(key) || 0) + qty);
  }
  return qtyMap;
};

const reserveStockForLines = async (session, moveLines) => {
  const qtyMap = aggregateQtyByProductAndLocation(moveLines);
  for (const [key, reserveQty] of qtyMap.entries()) {
    const [productId, locationId] = key.split('_');
    const quant = await StockQuant.findOne({ productId, locationId }).session(session);
    const availableQty = quant ? quant.quantity - quant.reservedQty : 0;
    if (availableQty < reserveQty) {
      throw new Error(`Insufficient stock to reserve. Available: ${availableQty}, Required: ${reserveQty}`);
    }
  }
  const ops = Array.from(qtyMap.entries()).map(([key, reserveQty]) => {
    const [productId, locationId] = key.split('_');
    return { updateOne: { filter: { productId, locationId }, update: { $inc: { reservedQty: reserveQty } }, upsert: true } };
  });
  if (ops.length > 0) await StockQuant.bulkWrite(ops, { session });
};

const unreserveStockForLines = async (session, moveLines) => {
  const qtyMap = aggregateQtyByProductAndLocation(moveLines);
  const ops = Array.from(qtyMap.entries()).map(([key, unreserveQty]) => {
    const [productId, locationId] = key.split('_');
    return { updateOne: { filter: { productId, locationId }, update: { $inc: { reservedQty: -unreserveQty } } } };
  });
  if (ops.length > 0) await StockQuant.bulkWrite(ops, { session });
};

const applyTransferLines = async (session, transfer, moveLines, userId, fromReserved = false) => {
  if (!moveLines.length) {
    throw new Error("Transfer has no product lines");
  }

  for (const line of moveLines) {
    const qtyToTransfer = line.qtyDone > 0 ? line.qtyDone : line.qtyOrdered;
    const fromLocationId = line.fromLocationId || transfer.sourceLocation || null;

    const srcQuant = await StockQuant.findOne({ productId: line.productId, locationId: fromLocationId }).session(
      session,
    );
    const quantity = srcQuant ? srcQuant.quantity : 0;
    const reserved = srcQuant ? srcQuant.reservedQty : 0;
    const available = fromReserved ? quantity : quantity - reserved;

    if (available < qtyToTransfer) {
      throw new Error(
        `Insufficient stock at source location. Available: ${available}, Required: ${qtyToTransfer}`,
      );
    }
  }

  for (const line of moveLines) {
    const qtyToTransfer = line.qtyDone > 0 ? line.qtyDone : line.qtyOrdered;
    const fromLocationId = line.fromLocationId || transfer.sourceLocation || null;
    const toLocationId = line.toLocationId || transfer.destinationLocation || null;

    // If stock was reserved, also decrement reservedQty
    await StockQuant.findOneAndUpdate(
      { productId: line.productId, locationId: fromLocationId },
      fromReserved
        ? { $inc: { quantity: -qtyToTransfer, reservedQty: -qtyToTransfer } }
        : { $inc: { quantity: -qtyToTransfer } },
      { session },
    );

    await StockQuant.findOneAndUpdate(
      { productId: line.productId, locationId: toLocationId },
      { $inc: { quantity: qtyToTransfer } },
      { upsert: true, session },
    );

    await StockMove.create(
      [
        {
          reference: transfer.reference,
          pickingId: transfer._id,
          productId: line.productId,
          fromLocationId,
          toLocationId,
          quantity: qtyToTransfer,
          uom: line.uom,
          moveType: "INTERNAL",
          status: "done",
          createdBy: userId,
        },
      ],
      { session },
    );

    line.qtyDone = qtyToTransfer;
    line.status = "done";
    await line.save({ session });
  }

  transfer.status = "done";
  await transfer.save({ session });
};

/**
 * @desc    Get all transfers
 * @route   GET /api/transfers
 * @access  Private
 */
exports.getTransfers = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 25 } = req.query;

    const filter = getTransferScopeFilter(req);
    if (req.user?.role === "manager") {
      const staffIds = await getStaffUserIds();
      if (staffIds.length > 0) {
        filter.createdBy = { $nin: staffIds };
      }
    }
    if (status) filter.status = status;
    if (search) {
      filter.$or = [{ reference: { $regex: search, $options: "i" } }];
    }

    const total = await StockPicking.countDocuments(filter);
    const transfers = await StockPicking.find(filter)
      .populate("createdBy", "name email")
      .populate("sourceLocation", "name shortCode")
      .populate("destinationLocation", "name shortCode")
      .sort("-createdAt")
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: transfers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      reference: incomingRef,
      sourceLocation,
      destinationLocation,
      scheduledDate,
      notes,
      moveLines,
    } = req.body;

    const isStaff = isStaffUser(req.user);

    if (sourceLocation && !mongoose.Types.ObjectId.isValid(sourceLocation)) {
      return res.status(400).json({ success: false, message: "Invalid source location" });
    }
    if (destinationLocation && !mongoose.Types.ObjectId.isValid(destinationLocation)) {
      return res.status(400).json({ success: false, message: "Invalid destination location" });
    }
    if (sourceLocation && destinationLocation && String(sourceLocation) === String(destinationLocation)) {
      return res.status(400).json({
        success: false,
        message: "Source and destination cannot be the same location",
      });
    }

    const locScope = ensureStaffLocationScope(sourceLocation, destinationLocation, req.user);
    if (!locScope.ok) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: locScope.message });
    }

    if (Array.isArray(moveLines) && moveLines.length > 0) {
      const hasInvalidLine = moveLines.some((line) => {
        const qtyOrdered = Number(line?.qtyOrdered || 0);
        const effectiveFrom = line?.fromLocationId || sourceLocation;
        const effectiveTo = line?.toLocationId || destinationLocation;
        return (
          !line?.productId ||
          !mongoose.Types.ObjectId.isValid(line.productId) ||
          !mongoose.Types.ObjectId.isValid(effectiveFrom) ||
          !mongoose.Types.ObjectId.isValid(effectiveTo) ||
          qtyOrdered <= 0 ||
          !effectiveFrom ||
          !effectiveTo
        );
      });

      if (hasInvalidLine) {
        return res.status(400).json({
          success: false,
          message:
            "Each move line must include product, quantity, source location, and destination location",
        });
      }

      const locationIds = collectEffectiveLocationIds(
        moveLines,
        sourceLocation,
        destinationLocation,
      );
      const locationIdsExist = await validateLocationIdsExist(locationIds);
      if (!locationIdsExist) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Invalid source or destination location selection",
        });
      }
    }

    let reference = incomingRef?.trim();
    if (reference) {
      const exists = await StockPicking.exists({ reference }).session(session);
      if (exists) {
        await session.abortTransaction();
        return res
          .status(400)
          .json({ success: false, message: "Reference already exists" });
      }
    } else {
      reference = await generateReference("INTERNAL");
    }

    const [transfer] = await StockPicking.create(
      [
        {
          reference,
          pickingType: "INTERNAL",
          sourceLocation: sourceLocation || null,
          destinationLocation: destinationLocation || null,
          scheduledDate,
          notes,
          status: "draft",
          createdBy: req.user._id,
          createdByRole: req.user?.role || "staff",
        },
      ],
      { session },
    );

    let insertedLines = [];
    if (moveLines && moveLines.length > 0) {
      const lines = moveLines.map((line) => ({
        pickingId: transfer._id,
        productId: line.productId,
        qtyOrdered: line.qtyOrdered,
        qtyDone: line.qtyDone || 0,
        uom: line.uom || "units",
        fromLocationId: line.fromLocationId || sourceLocation,
        toLocationId: line.toLocationId || destinationLocation,
        status: "draft",
      }));
      insertedLines = await StockMoveLine.insertMany(lines, { session });
    }

    if (isStaffUser(req.user)) {
      if (!insertedLines.length) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Staff transfer requires at least one product line",
        });
      }
      await applyTransferLines(session, transfer, insertedLines, req.user._id);
    }

    await session.commitTransaction();

    const populatedTransfer = await StockPicking.findById(transfer._id)
      .populate("createdBy", "name email")
      .populate({
        path: "moveLines",
        populate: [
          { path: "productId", select: "name sku uom" },
          { path: "fromLocationId", select: "name shortCode" },
          { path: "toLocationId", select: "name shortCode" },
        ],
      });

    res.status(201).json({ success: true, data: populatedTransfer });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Get single transfer
 * @route   GET /api/transfers/:id
 * @access  Private
 */
exports.getTransfer = async (req, res, next) => {
  try {
    const transfer = await StockPicking.findOne({
      _id: req.params.id,
      ...getTransferScopeFilter(req),
    })
      .populate("createdBy", "name email")
      .populate("sourceLocation", "name shortCode")
      .populate("destinationLocation", "name shortCode")
      .populate({
        path: "moveLines",
        populate: [
          { path: "productId", select: "name sku uom" },
          { path: "fromLocationId", select: "name shortCode" },
          { path: "toLocationId", select: "name shortCode" },
        ],
      });

    if (!transfer) {
      return res
        .status(404)
        .json({ success: false, message: "Transfer not found" });
    }

    if (req.user?.role === "manager" && transfer.createdByRole === "staff") {
      return res.status(404).json({ success: false, message: "Transfer not found" });
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transfer = await StockPicking.findOne({
      _id: req.params.id,
      ...getTransferScopeFilter(req),
    }).session(session);

    if (!transfer) {
      return res
        .status(404)
        .json({ success: false, message: "Transfer not found" });
    }

    if (["done", "cancelled"].includes(transfer.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot edit a ${transfer.status} transfer`,
      });
    }

    const {
      reference: incomingRef,
      sourceLocation,
      destinationLocation,
      scheduledDate,
      notes,
      status,
      moveLines,
    } = req.body;

    const isStaff = isStaffUser(req.user);

    if (isStaffUser(req.user) && status && status !== transfer.status) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "Staff cannot change transfer status manually",
      });
    }

    if (sourceLocation && !mongoose.Types.ObjectId.isValid(sourceLocation)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid source location" });
    }
    if (destinationLocation && !mongoose.Types.ObjectId.isValid(destinationLocation)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid destination location" });
    }
    if (sourceLocation && destinationLocation && String(sourceLocation) === String(destinationLocation)) {
      return res.status(400).json({
        success: false,
        message: "Source and destination cannot be the same location",
      });
    }

    const locScope = ensureStaffLocationScope(
      sourceLocation || transfer.sourceLocation,
      destinationLocation || transfer.destinationLocation,
      req.user,
    );
    if (!locScope.ok) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: locScope.message });
    }

    if (Array.isArray(moveLines) && moveLines.length > 0) {
      const hasInvalidLine = moveLines.some((line) => {
        const qtyOrdered = Number(line?.qtyOrdered || 0);
        const effectiveFrom = line?.fromLocationId || sourceLocation || transfer.sourceLocation;
        const effectiveTo = line?.toLocationId || destinationLocation || transfer.destinationLocation;
        return (
          !line?.productId ||
          !mongoose.Types.ObjectId.isValid(line.productId) ||
          !mongoose.Types.ObjectId.isValid(effectiveFrom) ||
          !mongoose.Types.ObjectId.isValid(effectiveTo) ||
          qtyOrdered <= 0 ||
          !effectiveFrom ||
          !effectiveTo
        );
      });

      if (hasInvalidLine) {
        return res.status(400).json({
          success: false,
          message:
            "Each move line must include product, quantity, source location, and destination location",
        });
      }

      const locationIds = collectEffectiveLocationIds(
        moveLines,
        sourceLocation || transfer.sourceLocation,
        destinationLocation || transfer.destinationLocation,
      );
      const locationIdsExist = await validateLocationIdsExist(locationIds);
      if (!locationIdsExist) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Invalid source or destination location selection",
        });
      }
    }

    if (
      incomingRef &&
      incomingRef.trim() &&
      incomingRef.trim() !== transfer.reference
    ) {
      const exists = await StockPicking.exists({
        reference: incomingRef.trim(),
      }).session(session);
      if (exists) {
        await session.abortTransaction();
        return res
          .status(400)
          .json({ success: false, message: "Reference already exists" });
      }
      transfer.reference = incomingRef.trim();
    }

    // Capture status BEFORE mutating the document
    const previousStatus = transfer.status;
    const isBecomingReady = status === 'ready' && previousStatus !== 'ready';
    const isBecomingDone = status === 'done' && previousStatus !== 'done';
    const wasReady = previousStatus === 'ready';

    if (scheduledDate !== undefined) transfer.scheduledDate = scheduledDate;
    if (sourceLocation !== undefined) transfer.sourceLocation = sourceLocation || null;
    if (destinationLocation !== undefined) transfer.destinationLocation = destinationLocation || null;
    if (notes !== undefined) transfer.notes = notes;
    if (status) transfer.status = status;

    await transfer.save({ session });

    let updatedLines = [];
    if (moveLines && moveLines.length > 0) {
      await StockMoveLine.deleteMany({ pickingId: transfer._id }).session(session);
      const lines = moveLines.map((line) => ({
        pickingId: transfer._id,
        productId: line.productId,
        qtyOrdered: line.qtyOrdered,
        qtyDone: line.qtyDone || 0,
        uom: line.uom || "units",
        fromLocationId: line.fromLocationId || transfer.sourceLocation,
        toLocationId: line.toLocationId || transfer.destinationLocation,
        status: transfer.status,
      }));
      updatedLines = await StockMoveLine.insertMany(lines, { session });
    } else {
      updatedLines = await StockMoveLine.find({ pickingId: transfer._id }).session(session);
    }

    if (isStaffUser(req.user) || isBecomingDone) {
      if (!updatedLines.length) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Transfer requires at least one product line",
        });
      }
      // If stock was reserved (was in ready state), consume from reserved pool
      await applyTransferLines(session, transfer, updatedLines, req.user._id, wasReady);
    } else if (isBecomingReady) {
      // Reserve stock at source when transitioning to ready
      if (!updatedLines.length) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Transfer requires at least one product line to be marked ready",
        });
      }
      try {
        await reserveStockForLines(session, updatedLines);
        await StockMoveLine.updateMany({ pickingId: transfer._id }, { status: 'ready' }, { session });
      } catch (e) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: e.message });
      }
    } else if (wasReady && status && status !== 'ready' && status !== 'done') {
      // Moving away from ready (e.g., back to draft) — unreserve
      await unreserveStockForLines(session, updatedLines);
    }

    await session.commitTransaction();

    const updatedTransfer = await StockPicking.findById(transfer._id)
      .populate("createdBy", "name email")
      .populate("sourceLocation", "name shortCode")
      .populate("destinationLocation", "name shortCode")
      .populate({
        path: "moveLines",
        populate: [
          { path: "productId", select: "name sku uom" },
          { path: "fromLocationId", select: "name shortCode" },
          { path: "toLocationId", select: "name shortCode" },
        ],
      });

    res.json({ success: true, data: updatedTransfer });
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
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const transfer = await StockPicking.findOne({
      _id: req.params.id,
      ...getTransferScopeFilter(req),
    }).session(session);

    if (!transfer) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "Transfer not found" });
    }

    if (transfer.status === "done") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Cannot cancel a completed transfer",
      });
    }

    // If stock was reserved (ready state), undo the reservation
    if (transfer.status === "ready") {
      const moveLines = await StockMoveLine.find({ pickingId: transfer._id }).session(session);
      if (moveLines.length > 0) {
        await unreserveStockForLines(session, moveLines);
      }
    }

    transfer.status = "cancelled";
    await transfer.save({ session });

    await StockMoveLine.updateMany(
      { pickingId: transfer._id },
      { status: "cancelled" },
      { session }
    );

    await session.commitTransaction();
    res.json({ success: true, message: "Transfer cancelled", data: transfer });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
