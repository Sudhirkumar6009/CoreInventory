const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAdjustments,
  createAdjustment,
  getAdjustment,
  validateAdjustment,
  cancelAdjustment,
} = require('../controllers/adjustmentController');

router.use(protect);

router.route('/').get(getAdjustments).post(createAdjustment);
router.route('/:id').get(getAdjustment);
router.post('/:id/validate', authorize('manager'), validateAdjustment);
router.post('/:id/cancel', cancelAdjustment);

module.exports = router;
