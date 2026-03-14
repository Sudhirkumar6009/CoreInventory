const mongoose = require("mongoose");
const StockPicking = require("../models/StockPicking");
const StockMoveLine = require("../models/StockMoveLine");
const StockMove = require("../models/StockMove");
const StockQuant = require("../models/StockQuant");
const generateReference = require("../utils/generateReference");

/**
 * @desc    Get all transfers
 * @route   GET /api/transfers
 * @access  Private
 */
exports.getTransfers = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 25 } = req.query;

    const filter = { pickingType: "INTERNAL" };
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
  try {
    const {
      reference: incomingRef,
      sourceLocation,
      destinationLocation,
      scheduledDate,
      notes,
      moveLines,
    } = req.body;

    if (sourceLocation && !mongoose.Types.ObjectId.isValid(sourceLocation)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid source location" });
    }
    if (
      destinationLocation &&
      !mongoose.Types.ObjectId.isValid(destinationLocation)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid destination location" });
    }
    if (
      sourceLocation &&
      destinationLocation &&
      String(sourceLocation) === String(destinationLocation)
    ) {
      return res.status(400).json({
        success: false,
        message: "Source and destination cannot be the same location",
      });
    }

    if (Array.isArray(moveLines) && moveLines.length > 0) {
      const hasInvalidLine = moveLines.some((line) => {
        const qtyOrdered = Number(line?.qtyOrdered || 0);
        const effectiveFrom = line?.fromLocationId || sourceLocation;
        const effectiveTo = line?.toLocationId || destinationLocation;
        return (
          !line?.productId ||
          !mongoose.Types.ObjectId.isValid(line.productId) ||
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
    }

    let reference = incomingRef?.trim();
    if (reference) {
      const exists = await StockPicking.exists({ reference });
      if (exists) {
        return res
          .status(400)
          .json({ success: false, message: "Reference already exists" });
      }
    } else {
      reference = await generateReference("INTERNAL");
    }

    const transfer = await StockPicking.create({
      reference,
      pickingType: "INTERNAL",
      sourceLocation: sourceLocation || null,
      destinationLocation: destinationLocation || null,
      scheduledDate,
      notes,
      status: "draft",
      createdBy: req.user._id,
    });

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
      await StockMoveLine.insertMany(lines);
    }

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
    const transfer = await StockPicking.findOne({
      _id: req.params.id,
      pickingType: "INTERNAL",
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
    const transfer = await StockPicking.findOne({
      _id: req.params.id,
      pickingType: "INTERNAL",
    });

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

    if (sourceLocation && !mongoose.Types.ObjectId.isValid(sourceLocation)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid source location" });
    }
    if (
      destinationLocation &&
      !mongoose.Types.ObjectId.isValid(destinationLocation)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid destination location" });
    }
    if (
      sourceLocation &&
      destinationLocation &&
      String(sourceLocation) === String(destinationLocation)
    ) {
      return res.status(400).json({
        success: false,
        message: "Source and destination cannot be the same location",
      });
    }

    if (Array.isArray(moveLines) && moveLines.length > 0) {
      const hasInvalidLine = moveLines.some((line) => {
        const qtyOrdered = Number(line?.qtyOrdered || 0);
        const effectiveFrom =
          line?.fromLocationId || sourceLocation || transfer.sourceLocation;
        const effectiveTo =
          line?.toLocationId ||
          destinationLocation ||
          transfer.destinationLocation;
        return (
          !line?.productId ||
          !mongoose.Types.ObjectId.isValid(line.productId) ||
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
    }

    if (
      incomingRef &&
      incomingRef.trim() &&
      incomingRef.trim() !== transfer.reference
    ) {
      const exists = await StockPicking.exists({
        reference: incomingRef.trim(),
      });
      if (exists) {
        return res
          .status(400)
          .json({ success: false, message: "Reference already exists" });
      }
      transfer.reference = incomingRef.trim();
    }

    if (scheduledDate !== undefined) transfer.scheduledDate = scheduledDate;
    if (sourceLocation !== undefined)
      transfer.sourceLocation = sourceLocation || null;
    if (destinationLocation !== undefined)
      transfer.destinationLocation = destinationLocation || null;
    if (notes !== undefined) transfer.notes = notes;
    if (status) transfer.status = status;

    await transfer.save();

    if (moveLines && moveLines.length > 0) {
      await StockMoveLine.deleteMany({ pickingId: transfer._id });
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
      await StockMoveLine.insertMany(lines);
    }

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
    const transfer = await StockPicking.findOne({
      _id: req.params.id,
      pickingType: "INTERNAL",
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

    // Check availability
    for (const line of moveLines) {
      const qtyToTransfer = line.qtyDone > 0 ? line.qtyDone : line.qtyOrdered;

      const srcQuant = await StockQuant.findOne({
        productId: line.productId,
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
      const fromLocationId =
        line.fromLocationId || transfer.sourceLocation || null;
      const toLocationId =
        line.toLocationId || transfer.destinationLocation || null;

      // Decrease at source
      await StockQuant.findOneAndUpdate(
        { productId: line.productId },
        { $inc: { quantity: -qtyToTransfer } },
        { session },
      );

      // Increase at destination
      await StockQuant.findOneAndUpdate(
        { productId: line.productId },
        { $inc: { quantity: qtyToTransfer } },
        { upsert: true, session },
      );

      // Ledger entry
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
            createdBy: req.user._id,
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
      pickingType: "INTERNAL",
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
