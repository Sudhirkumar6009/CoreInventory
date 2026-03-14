const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getMoves, getMove } = require('../controllers/moveController');

router.use(protect);

router.get('/', getMoves);
router.get('/:id', getMove);

module.exports = router;
