const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getAdjustments,
  createAdjustment,
  getAdjustment,
  updateAdjustment,
} = require("../controllers/adjustmentController");

router.use(protect);
router.use(protect, authorize("staff"));
router.route("/").get(getAdjustments).post(createAdjustment);
router.route("/:id").get(getAdjustment).put(updateAdjustment);

router.post("/:id/validate", validateAdjustment);
