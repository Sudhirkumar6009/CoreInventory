const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getLocations,
  createLocation,
  getLocation,
  updateLocation,
  deleteLocation,
} = require('../controllers/locationController');

router.route('/').get(getLocations).post(protect, authorize('manager'), createLocation);
router
  .route('/:id')
  .get(protect, getLocation)
  .put(protect, authorize('manager'), updateLocation)
  .delete(protect, authorize('manager'), deleteLocation);

module.exports = router;
