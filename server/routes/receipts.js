const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getReceipts,
  createReceipt,
  getReceipt,
  updateReceipt,
  cancelReceipt,
} = require('../controllers/receiptController');

router.use(protect);

router.route('/').get(getReceipts).post(createReceipt);
router.route('/:id').get(getReceipt).put(updateReceipt);
router.post('/:id/cancel', cancelReceipt);

module.exports = router;
