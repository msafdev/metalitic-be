const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authMiddleware");
const verifyToken = require("../middlewares/verifyToken");

const {
  loginUser,
  logout,
  checkAuth,
  userProfile,
  getUnitbyUser,
  getNodesbyUser,
  getNodebyDateTime,
  getNodePicturebyNode,
  getNodeChartbyTime,
} = require("../controllers/deviceController");

// Public Routes
router.post("/login", loginUser);
router.get("/logout", logout);
router.get("/check-auth", verifyToken, checkAuth);

// User Info Routes
router.get("/user/profile", authenticate, userProfile);
router.get("/unit", authenticate, getUnitbyUser);
router.get("/nodes", authenticate, getNodesbyUser);

// Node Data Routes
router.post("/node/document", authenticate, getNodebyDateTime);
router.post("/node/picture", authenticate, getNodePicturebyNode);
router.post("/node/chart", authenticate, getNodeChartbyTime);

module.exports = router;
