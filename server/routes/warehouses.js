const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getWarehouses,
  createWarehouse,
  getWarehouse,
  updateWarehouse,
  deleteWarehouse,
} = require('../controllers/warehouseController');

router.use(protect);

router.route('/').get(getWarehouses).post(authorize('manager'), createWarehouse);
router
  .route('/:id')
  .get(getWarehouse)
  .put(authorize('manager'), updateWarehouse)
  .delete(authorize('manager'), deleteWarehouse);

module.exports = router;
