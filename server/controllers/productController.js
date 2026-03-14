const Product = require("../models/Product");
const ProductCategory = require("../models/ProductCategory");
const StockQuant = require("../models/StockQuant");
const ReorderRule = require("../models/ReorderRule");
const Location = require("../models/Location");

const toNumberOrDefault = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const normalizeProductPayload = (payload = {}, isUpdate = false) => {
  const normalized = { ...payload };

  const categoryId = payload.categoryId ?? payload.category;
  if (categoryId !== undefined) normalized.categoryId = categoryId || null;

  if (payload.unitOfMeasure !== undefined) {
    normalized.uom = payload.unitOfMeasure;
  }

  if (payload.perUnitCost !== undefined) {
    normalized.perUnitCost = toNumberOrDefault(payload.perUnitCost, 0);
  }

  if (payload.reorderPoint !== undefined) {
    normalized.reorderPoint = toNumberOrDefault(payload.reorderPoint, 0);
  }

  if (payload.maxStock !== undefined) {
    normalized.maxStock = toNumberOrDefault(payload.maxStock, 0);
  }

  if (!isUpdate && payload.initialStock !== undefined) {
    normalized.initialStock = toNumberOrDefault(payload.initialStock, 0);
  }

  delete normalized.category;
  delete normalized.unitOfMeasure;

  return normalized;
};

const enrichProduct = (product, stock = null) => {
  const hasStockData =
    stock && (stock.onHand !== undefined || stock.reservedQty !== undefined);
  const fallbackOnHand = toNumberOrDefault(product.initialStock, 0);
  const onHand = hasStockData
    ? toNumberOrDefault(stock.onHand, 0)
    : fallbackOnHand;
  const reservedQty = hasStockData
    ? toNumberOrDefault(stock.reservedQty, 0)
    : 0;

  return {
    ...product,
    category: product.categoryId,
    unitOfMeasure: product.uom,
    perUnitCost: toNumberOrDefault(product.perUnitCost, 0),
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

    const productIds = products.map((product) => product._id);
    const stockRows = productIds.length
      ? await StockQuant.aggregate([
          { $match: { productId: { $in: productIds } } },
          {
            $group: {
              _id: "$productId",
              onHand: { $sum: "$quantity" },
              reservedQty: { $sum: "$reservedQty" },
            },
          },
        ])
      : [];

    const stockByProductId = stockRows.reduce((acc, row) => {
      acc[row._id.toString()] = {
        onHand: toNumberOrDefault(row.onHand, 0),
        reservedQty: toNumberOrDefault(row.reservedQty, 0),
      };
      return acc;
    }, {});

    const enrichedProducts = products.map((product) =>
      enrichProduct(product, stockByProductId[product._id.toString()]),
    );

    res.json({
      success: true,
      data: enrichedProducts,
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
  try {
    const payload = normalizeProductPayload(req.body);
    const product = await Product.create(payload);

    // If initialStock > 0, create a StockQuant record at the first available location
    let stockData = null;
    const initialStock = toNumberOrDefault(payload.initialStock, 0);
    if (initialStock > 0) {
      stockData = { onHand: initialStock, reservedQty: 0 };
      const defaultLocation = await Location.findOne().sort("createdAt");
      if (defaultLocation) {
        await StockQuant.findOneAndUpdate(
          { productId: product._id, locationId: defaultLocation._id },
          { $inc: { quantity: initialStock } },
          { upsert: true, new: true },
        );
      }
    }

    // Return enriched product with stock and perUnitCost
    const enrichedProduct = await Product.findById(product._id)
      .populate("categoryId", "name shortCode")
      .lean();

    res
      .status(201)
      .json({ success: true, data: enrichProduct(enrichedProduct, stockData) });
  } catch (error) {
    next(error);
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
      .populate({
        path: "locationId",
        populate: { path: "warehouseId", select: "name shortCode" },
      })
      .lean();

    const totalOnHand = stockQuants.reduce((sum, sq) => sum + sq.quantity, 0);
    const totalReserved = stockQuants.reduce(
      (sum, sq) => sum + sq.reservedQty,
      0,
    );
    const freeToUse = totalOnHand - totalReserved;

    res.json({
      success: true,
      data: {
        product: {
          id: product._id,
          name: product.name,
          sku: product.sku,
          uom: product.uom,
        },
        totalOnHand,
        totalReserved,
        freeToUse,
        byLocation: stockQuants.map((sq) => ({
          location: sq.locationId,
          quantity: sq.quantity,
          reservedQty: sq.reservedQty,
          freeToUse: sq.quantity - sq.reservedQty,
        })),
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
