const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getReceipts,
  createReceipt,
  getReceipt,
  updateReceipt,
  validateReceipt,
  cancelReceipt,
  returnReceipt,
} = require('../controllers/receiptController');

router.use(protect);

router.route('/').get(getReceipts).post(createReceipt);
router.route('/:id').get(getReceipt).put(updateReceipt);
router.post('/:id/validate', authorize('manager'), validateReceipt);
router.post('/:id/cancel', cancelReceipt);
router.post('/:id/return', authorize('manager'), returnReceipt);

module.exports = router;
