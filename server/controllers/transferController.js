const mongoose = require("mongoose");
const StockPicking = require("../models/StockPicking");
const StockMoveLine = require("../models/StockMoveLine");
const StockMove = require("../models/StockMove");
const StockQuant = require("../models/StockQuant");
const Location = require("../models/Location");
const User = require("../models/User");
const generateReference = require("../utils/generateReference");

const isStaffUser = (user) => user?.role === "staff";

const ensureStaffTextScope = (warehouseLabel, sourceText, destinationText, user) => {
  if (!isStaffUser(user)) return { ok: true };

  if (!warehouseLabel?.trim()) {
    return { ok: false, message: "Warehouse is required for staff transfers" };
  }
  if (!sourceText?.trim() || !destinationText?.trim()) {
    return { ok: false, message: "From and To are required for staff transfers" };
  }
  if (sourceText.trim().toLowerCase() === destinationText.trim().toLowerCase()) {
    return { ok: false, message: "From and To cannot be the same" };
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

const applyTransferLines = async (session, transfer, moveLines, userId) => {
  if (!moveLines.length) {
    throw new Error("Transfer has no product lines");
  }

  for (const line of moveLines) {
    const qtyToTransfer = line.qtyDone > 0 ? line.qtyDone : line.qtyOrdered;

    const srcQuant = await StockQuant.findOne({ productId: line.productId }).session(
      session,
    );
    const available = srcQuant ? srcQuant.quantity : 0;

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

    await StockQuant.findOneAndUpdate(
      { productId: line.productId },
      { $inc: { quantity: -qtyToTransfer } },
      { session },
    );

    await StockQuant.findOneAndUpdate(
      { productId: line.productId },
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
      sourceText,
      destinationText,
      warehouseLabel,
      scheduledDate,
      notes,
      moveLines,
    } = req.body;

    const isStaff = isStaffUser(req.user);

    if (!isStaff && sourceLocation && !mongoose.Types.ObjectId.isValid(sourceLocation)) {
      return res.status(400).json({ success: false, message: "Invalid source location" });
    }
    if (!isStaff && destinationLocation && !mongoose.Types.ObjectId.isValid(destinationLocation)) {
      return res.status(400).json({ success: false, message: "Invalid destination location" });
    }
    if (!isStaff && sourceLocation && destinationLocation && String(sourceLocation) === String(destinationLocation)) {
      return res.status(400).json({
        success: false,
        message: "Source and destination cannot be the same location",
      });
    }

    const textScope = ensureStaffTextScope(warehouseLabel, sourceText, destinationText, req.user);
    if (!textScope.ok) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: textScope.message });
    }

    if (Array.isArray(moveLines) && moveLines.length > 0) {
      const hasInvalidLine = moveLines.some((line) => {
        const qtyOrdered = Number(line?.qtyOrdered || 0);
        const effectiveFrom = isStaff ? "staff-text" : (line?.fromLocationId || sourceLocation);
        const effectiveTo = isStaff ? "staff-text" : (line?.toLocationId || destinationLocation);
        return (
          !line?.productId ||
          !mongoose.Types.ObjectId.isValid(line.productId) ||
          (!isStaff && !mongoose.Types.ObjectId.isValid(effectiveFrom)) ||
          (!isStaff && !mongoose.Types.ObjectId.isValid(effectiveTo)) ||
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

      if (!isStaff) {
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
          sourceLocation: isStaff ? null : (sourceLocation || null),
          destinationLocation: isStaff ? null : (destinationLocation || null),
          sourceText: isStaff ? sourceText.trim() : "",
          destinationText: isStaff ? destinationText.trim() : "",
          warehouseLabel: isStaff ? warehouseLabel.trim() : "",
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
        fromLocationId: isStaff ? null : (line.fromLocationId || sourceLocation),
        toLocationId: isStaff ? null : (line.toLocationId || destinationLocation),
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
      sourceText,
      destinationText,
      warehouseLabel,
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

    if (!isStaff && sourceLocation && !mongoose.Types.ObjectId.isValid(sourceLocation)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid source location" });
    }
    if (!isStaff && destinationLocation && !mongoose.Types.ObjectId.isValid(destinationLocation)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid destination location" });
    }
    if (!isStaff && sourceLocation && destinationLocation && String(sourceLocation) === String(destinationLocation)) {
      return res.status(400).json({
        success: false,
        message: "Source and destination cannot be the same location",
      });
    }

    const textScope = ensureStaffTextScope(
      warehouseLabel || transfer.warehouseLabel,
      sourceText || transfer.sourceText,
      destinationText || transfer.destinationText,
      req.user,
    );
    if (!textScope.ok) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: textScope.message });
    }

    if (Array.isArray(moveLines) && moveLines.length > 0) {
      const hasInvalidLine = moveLines.some((line) => {
        const qtyOrdered = Number(line?.qtyOrdered || 0);
        const effectiveFrom =
          isStaff ? "staff-text" : (line?.fromLocationId || sourceLocation || transfer.sourceLocation);
        const effectiveTo =
          isStaff
            ? "staff-text"
            : (line?.toLocationId || destinationLocation || transfer.destinationLocation);
        return (
          !line?.productId ||
          !mongoose.Types.ObjectId.isValid(line.productId) ||
          (!isStaff && !mongoose.Types.ObjectId.isValid(effectiveFrom)) ||
          (!isStaff && !mongoose.Types.ObjectId.isValid(effectiveTo)) ||
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

      if (!isStaff) {
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

    if (scheduledDate !== undefined) transfer.scheduledDate = scheduledDate;
    if (sourceLocation !== undefined)
      transfer.sourceLocation = isStaff ? null : (sourceLocation || null);
    if (destinationLocation !== undefined)
      transfer.destinationLocation = isStaff ? null : (destinationLocation || null);
    if (isStaff && sourceText !== undefined) transfer.sourceText = sourceText.trim();
    if (isStaff && destinationText !== undefined) transfer.destinationText = destinationText.trim();
    if (isStaff && warehouseLabel !== undefined) transfer.warehouseLabel = warehouseLabel.trim();
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
        fromLocationId: isStaff ? null : (line.fromLocationId || transfer.sourceLocation),
        toLocationId: isStaff ? null : (line.toLocationId || transfer.destinationLocation),
        status: transfer.status,
      }));
      updatedLines = await StockMoveLine.insertMany(lines, { session });
    } else {
      updatedLines = await StockMoveLine.find({ pickingId: transfer._id }).session(session);
    }

    if (isStaffUser(req.user)) {
      if (!updatedLines.length) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Staff transfer requires at least one product line",
        });
      }
      await applyTransferLines(session, transfer, updatedLines, req.user._id);
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
 * @desc    Validate transfer — move stock between locations (atomic)
 * @route   POST /api/transfers/:id/validate
 * @access  Private (Manager)
 */
exports.validateTransfer = async (req, res, next) => {
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
      return res
        .status(400)
        .json({ success: false, message: "Transfer is already validated" });
    }

    if (transfer.status === "cancelled") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Cannot validate a cancelled transfer",
      });
    }

    const moveLines = await StockMoveLine.find({
      pickingId: transfer._id,
    }).session(session);

    if (moveLines.length === 0) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ success: false, message: "Transfer has no product lines" });
    }

    await applyTransferLines(session, transfer, moveLines, req.user._id);

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

    res.json({
      success: true,
      message: "Transfer validated successfully",
      data: populatedTransfer,
    });
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
    const transfer = await StockPicking.findOne({
      _id: req.params.id,
      ...getTransferScopeFilter(req),
    });

    if (!transfer) {
      return res
        .status(404)
        .json({ success: false, message: "Transfer not found" });
    }

    if (transfer.status === "done") {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel a completed transfer",
      });
    }

    transfer.status = "cancelled";
    await transfer.save();

    await StockMoveLine.updateMany(
      { pickingId: transfer._id },
      { status: "cancelled" },
    );

    res.json({ success: true, message: "Transfer cancelled", data: transfer });
  } catch (error) {
    next(error);
  }
};
