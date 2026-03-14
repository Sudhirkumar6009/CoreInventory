const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getAdjustments,
  createAdjustment,
  getAdjustment,
  updateAdjustment,
  validateAdjustment,
} = require("../controllers/adjustmentController");

router.use(protect);
// Optional: restrict all following routes to staff
// router.use(authorize("staff")); 

router.route("/").get(getAdjustments).post(createAdjustment);
router.route("/:id").get(getAdjustment).put(updateAdjustment);

router.post("/:id/validate", validateAdjustment);

module.exports = router;
