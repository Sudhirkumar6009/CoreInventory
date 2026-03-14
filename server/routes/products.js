const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getProducts,
  createProduct,
  getProduct,
  updateProduct,
  deleteProduct,
  getProductStock,
  getCategories,
  createCategory,
  updateCategory,
  getReorderRules,
  createReorderRule,
  updateReorderRule,
  deleteReorderRule,
} = require('../controllers/productController');

router.use(protect);

// ===== Categories (must be before /:id routes) =====
router.route('/categories').get(getCategories).post(authorize('manager'), createCategory);
router.route('/categories/:id').put(authorize('manager'), updateCategory);

// ===== Reorder Rules =====
router.route('/reorder-rules').get(getReorderRules).post(authorize('manager'), createReorderRule);
router.route('/reorder-rules/:id').put(authorize('manager'), updateReorderRule).delete(authorize('manager'), deleteReorderRule);

// ===== Products =====
router.route('/').get(getProducts).post(authorize('manager'), createProduct);
router.route('/:id').get(getProduct).put(authorize('manager'), updateProduct).delete(authorize('manager'), deleteProduct);
router.get('/:id/stock', getProductStock);

module.exports = router;
