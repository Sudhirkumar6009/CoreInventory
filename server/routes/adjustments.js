const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getAdjustments,
  createAdjustment,
  getAdjustment,
  updateAdjustment,
} = require("../controllers/adjustmentController");

router.use(protect);
// Optional: restrict all following routes to staff
// router.use(authorize("staff")); 

router.route("/").get(getAdjustments).post(createAdjustment);
router.route("/:id").get(getAdjustment).put(updateAdjustment);
module.exports = router;
