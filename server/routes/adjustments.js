const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getAdjustments,
  createAdjustment,
  getAdjustment,
  updateAdjustment,
} = require('../controllers/adjustmentController');

router.use(protect);

router.route('/').get(getAdjustments).post(createAdjustment);
router.route('/:id').get(getAdjustment).put(updateAdjustment);

module.exports = router;
