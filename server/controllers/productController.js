const mongoose = require('mongoose');
const Product = require('../models/Product');
const ProductCategory = require('../models/ProductCategory');
const StockQuant = require('../models/StockQuant');
const ReorderRule = require('../models/ReorderRule');

const toNumberOrDefault = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeProductPayload = (body = {}, isUpdate = false) => {
  const payload = {};

  if (!isUpdate || body.name !== undefined) payload.name = body.name;
  if (!isUpdate || body.sku !== undefined) payload.sku = body.sku;

  if (!isUpdate || body.categoryId !== undefined || body.category !== undefined) {
    payload.categoryId = body.categoryId ?? body.category ?? null;
  }

  if (!isUpdate || body.uom !== undefined || body.unitOfMeasure !== undefined) {
    payload.uom = body.uom || body.unitOfMeasure || 'units';
  }

  if (!isUpdate || body.perUnitCost !== undefined) {
    payload.perUnitCost = toNumberOrDefault(body.perUnitCost, 0);
  }

  if (!isUpdate || body.reorderPoint !== undefined) {
    payload.reorderPoint = toNumberOrDefault(body.reorderPoint, 0);
  }

  if (!isUpdate || body.maxStock !== undefined) {
    payload.maxStock = toNumberOrDefault(body.maxStock, 0);
  }

  return payload;
};

const enrichProduct = (product, stockData = null) => {
  const onHand = stockData?.onHand || 0;
  const reservedQty = stockData?.reservedQty || 0;
  return {
    ...product,
    onHand,
    reservedQty,
    freeToUse: onHand - reservedQty,
  };
};

// ==================== PRODUCTS ====================

/**
 * @desc    Get all products (with search & filters)
 * @route   GET /api/products
 * @access  Private
 */
exports.getProducts = async (req, res, next) => {
  try {
    const {
      search,
      category,
      locationId,
      page = 1,
      limit = 25,
      sort = "-createdAt",
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }

    if (category) {
      filter.categoryId = category;
    }

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .populate("categoryId", "name shortCode")
      .sort(sort)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const productIds = products.map((p) => p._id);
    let stockMap = new Map();

    if (productIds.length > 0) {
      const stockMatch = { productId: { $in: productIds } };
      if (locationId && mongoose.Types.ObjectId.isValid(locationId)) {
        stockMatch.locationId = new mongoose.Types.ObjectId(locationId);
      }

      const stockSummary = await StockQuant.aggregate([
        { $match: stockMatch },
        {
          $group: {
            _id: "$productId",
            onHand: { $sum: "$quantity" },
            reservedQty: { $sum: "$reservedQty" },
          },
        },
      ]);

      stockMap = new Map(
        stockSummary.map((row) => [
          String(row._id),
          { onHand: row.onHand || 0, reservedQty: row.reservedQty || 0 },
        ]),
      );
    }

    const productsWithStock = products.map((product) => {
      const stock = stockMap.get(String(product._id)) || {
        onHand: 0,
        reservedQty: 0,
      };
      return {
        ...product,
        onHand: stock.onHand,
        reservedQty: stock.reservedQty,
        freeToUse: stock.onHand - stock.reservedQty,
      };
    });

    res.json({
      success: true,
      data: productsWithStock,
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
 * @desc    Create a product
 * @route   POST /api/products
 * @access  Private (Manager)
 */
exports.createProduct = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, sku, categoryId, uom, initialStock, initialLocationId } = req.body;

    const payload = {
      name,
      sku,
      categoryId: categoryId || null,
      uom: uom || "units",
      initialStock: Number(initialStock || 0),
    };

    const [product] = await Product.create([payload], { session });

    if (payload.initialStock > 0) {
      if (!initialLocationId || !mongoose.Types.ObjectId.isValid(initialLocationId)) {
        throw new Error("Initial stock requires a valid initialLocationId");
      }

      await StockQuant.findOneAndUpdate(
        { productId: product._id, locationId: initialLocationId },
        {
          $set: {
            quantity: payload.initialStock,
            reservedQty: 0,
          },
        },
        { upsert: true, session }
      );
    }

    await session.commitTransaction();

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Get single product
 * @route   GET /api/products/:id
 * @access  Private
 */
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("categoryId", "name shortCode")
      .lean();

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const stock = await StockQuant.aggregate([
      { $match: { productId: product._id } },
      {
        $group: {
          _id: "$productId",
          onHand: { $sum: "$quantity" },
          reservedQty: { $sum: "$reservedQty" },
        },
      },
    ]);

    const stockData = stock[0]
      ? { onHand: stock[0].onHand, reservedQty: stock[0].reservedQty }
      : null;

    res.json({ success: true, data: enrichProduct(product, stockData) });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update product
 * @route   PUT /api/products/:id
 * @access  Private (Manager)
 */
exports.updateProduct = async (req, res, next) => {
  try {
    const payload = normalizeProductPayload(req.body, true);

    const product = await Product.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Return enriched product with stock data
    const populatedProduct = await Product.findById(product._id)
      .populate("categoryId", "name shortCode")
      .lean();

    const stock = await StockQuant.aggregate([
      { $match: { productId: product._id } },
      {
        $group: {
          _id: "$productId",
          onHand: { $sum: "$quantity" },
          reservedQty: { $sum: "$reservedQty" },
        },
      },
    ]);

    const stockData = stock[0]
      ? { onHand: stock[0].onHand, reservedQty: stock[0].reservedQty }
      : null;

    res.json({
      success: true,
      data: enrichProduct(populatedProduct, stockData),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete product
 * @route   DELETE /api/products/:id
 * @access  Private (Manager)
 */
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Check if product has stock
    const hasStock = await StockQuant.findOne({
      productId: product._id,
      quantity: { $gt: 0 },
    });
    if (hasStock) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete product with existing stock. Adjust stock to zero first.",
      });
    }

    await product.deleteOne();
    res.json({ success: true, message: "Product deleted" });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get stock view for a product
 * @route   GET /api/products/:id/stock
 * @access  Private
 */
exports.getProductStock = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const stockQuants = await StockQuant.find({ productId: product._id })
      .populate('locationId', 'name shortCode')
      .lean();
    
    let totalReserved = 0;
    let totalOnHand = 0;
    const byLocation = stockQuants.map((sq) => {
      totalReserved += sq.reservedQty || 0;
      totalOnHand += sq.quantity || 0;
      return {
        locationId: sq.locationId?._id || sq.locationId,
        locationName: sq.locationId?.name || 'Unknown',
        onHand: sq.quantity || 0,
        reservedQty: sq.reservedQty || 0,
      };
    });

    res.json({
      success: true,
      data: {
        product: { id: product._id, name: product.name, sku: product.sku, uom: product.uom },
        totalOnHand,
        totalReserved,
        byLocation,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== CATEGORIES ====================

/**
 * @desc    Get all categories
 * @route   GET /api/products/categories
 * @access  Private
 */
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await ProductCategory.find().sort("name");
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a category
 * @route   POST /api/products/categories
 * @access  Private (Manager)
 */
exports.createCategory = async (req, res, next) => {
  try {
    const category = await ProductCategory.create(req.body);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update category
 * @route   PUT /api/products/categories/:id
 * @access  Private (Manager)
 */
exports.updateCategory = async (req, res, next) => {
  try {
    const category = await ProductCategory.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      },
    );
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }
    res.json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

// ==================== REORDER RULES ====================

/**
 * @desc    Get all reorder rules
 * @route   GET /api/products/reorder-rules
 * @access  Private
 */
exports.getReorderRules = async (req, res, next) => {
  try {
    const rules = await ReorderRule.find()
      .populate("productId", "name sku")
      .populate("warehouseId", "name shortCode")
      .sort("-createdAt");

    res.json({ success: true, data: rules });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a reorder rule
 * @route   POST /api/products/reorder-rules
 * @access  Private (Manager)
 */
exports.createReorderRule = async (req, res, next) => {
  try {
    const rule = await ReorderRule.create(req.body);
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update reorder rule
 * @route   PUT /api/products/reorder-rules/:id
 * @access  Private (Manager)
 */
exports.updateReorderRule = async (req, res, next) => {
  try {
    const rule = await ReorderRule.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!rule) {
      return res
        .status(404)
        .json({ success: false, message: "Reorder rule not found" });
    }
    res.json({ success: true, data: rule });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete reorder rule
 * @route   DELETE /api/products/reorder-rules/:id
 * @access  Private (Manager)
 */
exports.deleteReorderRule = async (req, res, next) => {
  try {
    const rule = await ReorderRule.findById(req.params.id);
    if (!rule) {
      return res
        .status(404)
        .json({ success: false, message: "Reorder rule not found" });
    }
    await rule.deleteOne();
    res.json({ success: true, message: "Reorder rule deleted" });
  } catch (error) {
    next(error);
  }
};
