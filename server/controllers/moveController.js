const StockMove = require('../models/StockMove');

const firstNonEmpty = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

const resolveLocationLabel = (location) => {
  if (!location) return null;
  if (typeof location === 'string') return location.trim() || null;
  return firstNonEmpty(location.name, location.shortCode);
};

const formatMoveForUi = (move) => {
  const isReceipt = move.moveType === 'IN';
  const isInternal = move.moveType === 'INTERNAL';
  const isDelivery = move.moveType === 'OUT';

  const partyLabel = firstNonEmpty(move.pickingId?.supplierOrCustomer, move.supplierOrCustomer);
  const sourceTextLabel = firstNonEmpty(move.pickingId?.sourceText, move.sourceText);
  const destinationTextLabel = firstNonEmpty(move.pickingId?.destinationText, move.destinationText);
  const warehouseLabel = firstNonEmpty(move.pickingId?.warehouseLabel, move.warehouseLabel);
  const fromLocationLabel = firstNonEmpty(
    resolveLocationLabel(move.fromLocationId),
    resolveLocationLabel(move.fromLocation),
    move.from
  );
  const toLocationLabel = firstNonEmpty(
    resolveLocationLabel(move.toLocationId),
    resolveLocationLabel(move.toLocation),
    move.to
  );
  const adjustmentLocationLabel = resolveLocationLabel(move.adjustmentId?.locationId);

  const fromDisplay = isReceipt
    ? (partyLabel || fromLocationLabel || 'Vendor')
    : (fromLocationLabel || adjustmentLocationLabel || '--');

  const toDisplay = isReceipt
    ? (toLocationLabel || '--')
    : isDelivery
      ? (partyLabel || toLocationLabel || '--')
    : isInternal
      ? (toLocationLabel || destinationTextLabel || '--')
      : (toLocationLabel || adjustmentLocationLabel || '--');

  const internalFromDisplay = isInternal
    ? firstNonEmpty(fromLocationLabel, sourceTextLabel, '--')
    : fromDisplay;
  const internalToDisplay = isInternal
    ? firstNonEmpty(toDisplay, destinationTextLabel, '--')
    : toDisplay;

  return {
    ...move,
    productName: firstNonEmpty(move.productId?.name, move.productName) || '--',
    product: move.productId || null,
    fromLocation: move.fromLocationId || null,
    toLocation: move.toLocationId || null,
    fromDisplay: internalFromDisplay,
    toDisplay: internalToDisplay,
    warehouseLabel: warehouseLabel || '--',
  };
};

/**
 * @desc    Get all stock moves (ledger)
 * @route   GET /api/moves
 * @access  Private
 */
exports.getMoves = async (req, res, next) => {
  try {
    const {
      moveType,
      type,
      product,
      dateFrom,
      dateTo,
      search,
      status,
      excludeType,
      page = 1,
      limit = 25,
      sort = '-createdAt',
    } = req.query;

    const filter = {};
    const requestedType = moveType || type;

    // Search logic: reference or product name/sku
    if (search) {
      const productIds = await require('../models/Product').find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { sku: { $regex: search, $options: 'i' } }
        ]
      }).distinct('_id');

      filter.$or = [
        { reference: { $regex: search, $options: 'i' } },
        { productId: { $in: productIds } }
      ];
    }

    // Role-based constraints
    if (req.user?.role === 'staff' && req.user.locationId) {
      const locId = req.user.locationId;
      const staffLocFilter = {
        $or: [
          { fromLocationId: locId },
          { toLocationId: locId }
        ]
      };
      
      // Combine with existing filters
      if (filter.$or) {
        // If we already have search $or, we must wrap it
        const searchOr = filter.$or;
        delete filter.$or;
        filter.$and = [
          { $or: searchOr },
          staffLocFilter
        ];
      } else {
        Object.assign(filter, staffLocFilter);
      }
    }

    if (requestedType) {
      filter.moveType = requestedType;
    } else if (excludeType) {
      filter.moveType = { $ne: excludeType };
    }

    if (product) filter.productId = product;
    if (status) filter.status = status;

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const total = await StockMove.countDocuments(filter);
    const moves = await StockMove.find(filter)
      .populate('productId', 'name sku uom')
      .populate('fromLocationId', 'name shortCode')
      .populate('toLocationId', 'name shortCode')
      .populate('pickingId', 'reference pickingType supplierOrCustomer sourceText destinationText warehouseLabel')
      .populate({
        path: 'adjustmentId',
        select: 'reference locationId',
        populate: { path: 'locationId', select: 'name shortCode' },
      })
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const normalizedMoves = moves.map(formatMoveForUi);

    res.json({
      success: true,
      data: normalizedMoves,
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
 * @desc    Get single stock move
 * @route   GET /api/moves/:id
 * @access  Private
 */
exports.getMove = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id };
    if (req.user?.role === 'staff') {
      filter.moveType = 'INTERNAL';
    }

    const move = await StockMove.findOne(filter)
      .populate('productId', 'name sku uom')
      .populate('fromLocationId', 'name shortCode')
      .populate('toLocationId', 'name shortCode')
      .populate('pickingId', 'reference pickingType status supplierOrCustomer sourceText destinationText warehouseLabel')
      .populate({
        path: 'adjustmentId',
        select: 'reference locationId',
        populate: { path: 'locationId', select: 'name shortCode' },
      })
      .populate('createdBy', 'name email');

    if (!move) {
      return res.status(404).json({ success: false, message: 'Stock move not found' });
    }

    res.json({ success: true, data: formatMoveForUi(move.toObject()) });
  } catch (error) {
    next(error);
  }
};
