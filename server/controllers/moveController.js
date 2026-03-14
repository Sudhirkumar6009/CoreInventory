const StockMove = require('../models/StockMove');

/**
 * @desc    Get all stock moves (ledger)
 * @route   GET /api/moves
 * @access  Private
 */
exports.getMoves = async (req, res, next) => {
  try {
    const {
      moveType,
      product,
      dateFrom,
      dateTo,
      search,
      page = 1,
      limit = 25,
      sort = '-createdAt',
    } = req.query;

    const filter = {};

    if (moveType) filter.moveType = moveType;
    if (product) filter.productId = product;
    if (search) {
      filter.reference = { $regex: search, $options: 'i' };
    }
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
      .populate('pickingId', 'reference pickingType')
      .populate('adjustmentId', 'reference')
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: moves,
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
    const move = await StockMove.findById(req.params.id)
      .populate('productId', 'name sku uom')
      .populate('fromLocationId', 'name shortCode')
      .populate('toLocationId', 'name shortCode')
      .populate('pickingId', 'reference pickingType status')
      .populate('adjustmentId', 'reference')
      .populate('createdBy', 'name email');

    if (!move) {
      return res.status(404).json({ success: false, message: 'Stock move not found' });
    }

    res.json({ success: true, data: move });
  } catch (error) {
    next(error);
  }
};
