const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getDeliveries,
  createDelivery,
  getDelivery,
  updateDelivery,
  cancelDelivery,
} = require('../controllers/deliveryController');

router.use(protect);

router.route('/').get(getDeliveries).post(createDelivery);
router.route('/:id').get(getDelivery).put(updateDelivery);
router.post('/:id/cancel', cancelDelivery);

module.exports = router;
