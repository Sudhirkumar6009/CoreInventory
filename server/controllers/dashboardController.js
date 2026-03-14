const Product = require('../models/Product');
const StockQuant = require('../models/StockQuant');
const StockPicking = require('../models/StockPicking');
const ReorderRule = require('../models/ReorderRule');

/**
 * @desc    Get dashboard KPIs
 * @route   GET /api/dashboard/kpis
 * @access  Private
 */
exports.getKpis = async (req, res, next) => {
  try {
    // Total products in stock
    const totalProducts = await Product.countDocuments();

    // Get all stock quants for calculations
    const stockQuants = await StockQuant.aggregate([
      {
        $group: {
          _id: '$productId',
          totalOnHand: { $sum: '$quantity' },
          totalReserved: { $sum: '$reservedQty' },
        },
      },
    ]);

    // Products with stock
    const productsInStock = stockQuants.filter((sq) => sq.totalOnHand > 0).length;

    // Low stock & out of stock — check against reorder points
    const products = await Product.find().lean();
    const stockMap = {};
    stockQuants.forEach((sq) => {
      stockMap[sq._id.toString()] = sq.totalOnHand;
    });

    let lowStockCount = 0;
    let outOfStockCount = 0;

    products.forEach((product) => {
      const onHand = stockMap[product._id.toString()] || 0;
      if (onHand === 0) {
        outOfStockCount++;
      } else if (product.reorderPoint > 0 && onHand <= product.reorderPoint) {
        lowStockCount++;
      }
    });

    // Pending receipts (status: draft | waiting | ready)
    const pendingReceipts = await StockPicking.countDocuments({
      pickingType: 'IN',
      status: { $in: ['draft', 'waiting', 'ready'] },
    });

    // Pending deliveries
    const pendingDeliveries = await StockPicking.countDocuments({
      pickingType: 'OUT',
      status: { $in: ['draft', 'waiting', 'ready'] },
    });

    // Internal transfers
    const pendingTransfers = await StockPicking.countDocuments({
      pickingType: 'INTERNAL',
      status: { $in: ['draft', 'waiting', 'ready'] },
    });

    res.json({
      success: true,
      data: {
        totalProducts,
        productsInStock,
        lowStockCount,
        outOfStockCount,
        pendingReceipts,
        pendingDeliveries,
        pendingTransfers,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get operations summary
 * @route   GET /api/dashboard/operations-summary
 * @access  Private
 */
exports.getOperationsSummary = async (req, res, next) => {
  try {
    const { dateFrom, dateTo, warehouse } = req.query;

    const dateFilter = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom);
    if (dateTo) dateFilter.$lte = new Date(dateTo);

    const matchStage = {};
    if (Object.keys(dateFilter).length > 0) matchStage.createdAt = dateFilter;

    // Receipts summary
    const receipts = await StockPicking.aggregate([
      { $match: { pickingType: 'IN', ...matchStage } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Deliveries summary
    const deliveries = await StockPicking.aggregate([
      { $match: { pickingType: 'OUT', ...matchStage } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Transfers summary
    const transfers = await StockPicking.aggregate([
      { $match: { pickingType: 'INTERNAL', ...matchStage } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const formatSummary = (data) => {
      const result = { draft: 0, waiting: 0, ready: 0, done: 0, cancelled: 0 };
      data.forEach((item) => {
        result[item._id] = item.count;
      });
      return result;
    };

    res.json({
      success: true,
      data: {
        receipts: formatSummary(receipts),
        deliveries: formatSummary(deliveries),
        transfers: formatSummary(transfers),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get alert data (low stock, out of stock, overdue)
 * @route   GET /api/dashboard/alerts
 * @access  Private
 */
exports.getAlerts = async (req, res, next) => {
  try {
    const alerts = [];

    // Low stock alerts
    const reorderRules = await ReorderRule.find().populate('productId', 'name sku').lean();

    for (const rule of reorderRules) {
      const stockQuants = await StockQuant.aggregate([
        { $match: { productId: rule.productId._id } },
        { $group: { _id: null, totalOnHand: { $sum: '$quantity' } } },
      ]);

      const onHand = stockQuants.length > 0 ? stockQuants[0].totalOnHand : 0;

      if (onHand <= 0) {
        alerts.push({
          type: 'out_of_stock',
          severity: 'critical',
          product: rule.productId,
          message: `${rule.productId.name} (${rule.productId.sku}) is out of stock`,
          onHand,
        });
      } else if (onHand <= rule.minQty) {
        alerts.push({
          type: 'low_stock',
          severity: 'warning',
          product: rule.productId,
          message: `${rule.productId.name} (${rule.productId.sku}) is below reorder point (${onHand} / ${rule.minQty})`,
          onHand,
          reorderPoint: rule.minQty,
        });
      }
    }

    // Overdue receipts
    const overdueReceipts = await StockPicking.find({
      pickingType: 'IN',
      status: { $in: ['draft', 'waiting', 'ready'] },
      scheduledDate: { $lt: new Date() },
    })
      .select('reference scheduledDate status')
      .lean();

    overdueReceipts.forEach((receipt) => {
      alerts.push({
        type: 'overdue_receipt',
        severity: 'warning',
        message: `Receipt ${receipt.reference} was scheduled for ${receipt.scheduledDate.toISOString().split('T')[0]}`,
        reference: receipt.reference,
      });
    });

    // Upcoming delivery deadlines (next 3 days)
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const upcomingDeliveries = await StockPicking.find({
      pickingType: 'OUT',
      status: { $in: ['draft', 'waiting', 'ready'] },
      scheduledDate: { $lte: threeDaysFromNow, $gte: new Date() },
    })
      .select('reference scheduledDate status')
      .lean();

    upcomingDeliveries.forEach((delivery) => {
      alerts.push({
        type: 'delivery_deadline',
        severity: 'info',
        message: `Delivery ${delivery.reference} deadline approaching (${delivery.scheduledDate.toISOString().split('T')[0]})`,
        reference: delivery.reference,
      });
    });

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
    });
  } catch (error) {
    next(error);
  }
};
