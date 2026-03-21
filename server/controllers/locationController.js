const Location = require('../models/Location');

/**
 * @desc    Get all locations
 * @route   GET /api/locations
 * @access  Private
 */
exports.getLocations = async (req, res, next) => {
  try {
    const locations = await Location.find()
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
    res.status(201).json({ success: true, data: location });
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
      .lean();

    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    // Stock is tracked at product level (not by location).
    location.stock = [];

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
    });

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

    await location.deleteOne();
    res.json({ success: true, message: 'Location deleted' });
  } catch (error) {
    next(error);
  }
};
