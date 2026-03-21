const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getWarehouses,
  getWarehouse,
  updateWarehouse,
} = require('../controllers/warehouseController');

router.use(protect);

router.route('/').get(getWarehouses);
router
  .route('/:id')
  .get(getWarehouse)
  .put(authorize('manager'), updateWarehouse);

module.exports = router;
