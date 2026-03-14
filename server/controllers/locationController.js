const Location = require('../models/Location');
const StockQuant = require('../models/StockQuant');

/**
 * @desc    Get all locations
 * @route   GET /api/locations
 * @access  Private
 */
exports.getLocations = async (req, res, next) => {
  try {
    const { warehouse } = req.query;

    const filter = {};
    if (warehouse) filter.warehouseId = warehouse;

    const locations = await Location.find(filter)
      .populate('warehouseId', 'name shortCode')
      .sort('name')
      .lean();

    res.json({ success: true, data: locations });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a location
 * @route   POST /api/locations
 * @access  Private (Manager)
 */
exports.createLocation = async (req, res, next) => {
  try {
    const location = await Location.create(req.body);
    const populated = await Location.findById(location._id).populate('warehouseId', 'name shortCode');
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single location (with stock)
 * @route   GET /api/locations/:id
 * @access  Private
 */
exports.getLocation = async (req, res, next) => {
  try {
    const location = await Location.findById(req.params.id)
      .populate('warehouseId', 'name shortCode')
      .lean();

    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    // Get stock at this location
    const stockQuants = await StockQuant.find({ locationId: location._id })
      .populate('productId', 'name sku uom')
      .lean();

    location.stock = stockQuants;

    res.json({ success: true, data: location });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update location
 * @route   PUT /api/locations/:id
 * @access  Private (Manager)
 */
exports.updateLocation = async (req, res, next) => {
  try {
    const location = await Location.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('warehouseId', 'name shortCode');

    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    res.json({ success: true, data: location });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete location
 * @route   DELETE /api/locations/:id
 * @access  Private (Manager)
 */
exports.deleteLocation = async (req, res, next) => {
  try {
    const location = await Location.findById(req.params.id);

    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    // Check for existing stock
    const hasStock = await StockQuant.findOne({ locationId: location._id, quantity: { $ne: 0 } });
    if (hasStock) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete location with existing stock.',
      });
    }

    await location.deleteOne();
    res.json({ success: true, message: 'Location deleted' });
  } catch (error) {
    next(error);
  }
};
