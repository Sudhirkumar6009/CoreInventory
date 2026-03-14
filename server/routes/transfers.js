const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getTransfers,
  createTransfer,
  getTransfer,
  updateTransfer,
  validateTransfer,
  cancelTransfer,
} = require('../controllers/transferController');

router.use(protect);

router.route('/').get(getTransfers).post(createTransfer);
router.route('/:id').get(getTransfer).put(updateTransfer);
router.post('/:id/validate', authorize('manager'), validateTransfer);
router.post('/:id/cancel', cancelTransfer);

module.exports = router;
