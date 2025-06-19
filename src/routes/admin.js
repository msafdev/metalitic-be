const express = require("express");
const router = express.Router();
const authenticate = require("../middlewares/authMiddleware");
const {
  registerSuperAdmin,
  loginAdmin,
  registerAdmin,
  verifyAdmin,
  deleteUser,
  getUser,
} = require("../controllers/adminController");

// Public Routes
router.post("/superadmin/register", registerSuperAdmin);
router.post("/superadmin/login", loginAdmin);

// Protected Routes (require authentication)
router.post("/superadmin/register", authenticate, registerAdmin);
router.post("/superadmin/verify", authenticate, verifyAdmin);

// User Management
router.get("/superadmin/users", authenticate, getUser);
router.delete("/superadmin/users", authenticate, deleteUser);

module.exports = router;
