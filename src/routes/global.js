const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authMiddleware");
const { checkAuth, getProfile } = require("../controllers/globalController");

router.get("/check-auth", authenticate, checkAuth);
router.get("/get-profile", authenticate, getProfile);

module.exports = router;