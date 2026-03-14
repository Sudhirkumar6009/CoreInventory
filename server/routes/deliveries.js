const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getDeliveries,
  createDelivery,
  getDelivery,
  updateDelivery,
  validateDelivery,
  cancelDelivery,
  returnDelivery,
} = require('../controllers/deliveryController');

router.use(protect);

router.route('/').get(getDeliveries).post(createDelivery);
router.route('/:id').get(getDelivery).put(updateDelivery);
router.post('/:id/validate', authorize('manager'), validateDelivery);
router.post('/:id/cancel', cancelDelivery);
router.post('/:id/return', authorize('manager'), returnDelivery);

module.exports = router;
