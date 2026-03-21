const Warehouse = require('../models/Warehouse');
const Location = require('../models/Location');

/**
 * @desc    Get all warehouses
 * @route   GET /api/warehouses
 * @access  Private
 */
exports.getWarehouses = async (req, res, next) => {
  try {
    const warehouses = await Warehouse.find().sort('name').lean();

    // Attach location count for each warehouse
    const result = await Promise.all(
      warehouses.map(async (wh) => {
        const locationCount = await Location.countDocuments({ warehouseId: wh._id });
        return { ...wh, locationCount };
      })
    );

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single warehouse (with locations)
 * @route   GET /api/warehouses/:id
 * @access  Private
 */
exports.getWarehouse = async (req, res, next) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id).lean();

    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Warehouse not found' });
    }

    const locations = await Location.find({ warehouseId: warehouse._id }).sort('name').lean();
    warehouse.locations = locations;

    res.json({ success: true, data: warehouse });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update warehouse
 * @route   PUT /api/warehouses/:id
 * @access  Private (Manager)
 */
exports.updateWarehouse = async (req, res, next) => {
  try {
    const warehouse = await Warehouse.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Warehouse not found' });
    }

    res.json({ success: true, data: warehouse });
  } catch (error) {
    next(error);
  }
};

