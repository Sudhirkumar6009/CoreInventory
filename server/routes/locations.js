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

router.use(protect);

router.route('/').get(getLocations).post(authorize('manager'), createLocation);
router
  .route('/:id')
  .get(getLocation)
  .put(authorize('manager'), updateLocation)
  .delete(authorize('manager'), deleteLocation);

module.exports = router;
