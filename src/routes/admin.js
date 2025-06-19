const express = require("express");
const router = express.Router();
const authenticate = require("../middlewares/authMiddleware");
const {
  registerSuperAdmin,
  loginAdmin,
  registerAdmin,
  verifyAdmin,
  deleteUser,
  getUsers,
} = require("../controllers/adminController");

// Public Routes
router.post("/register", registerSuperAdmin);
router.post("/login", loginAdmin);

// Protected Routes (require authentication)
router.post("/register", authenticate, registerAdmin);
router.post("/verify", authenticate, verifyAdmin);

// User Management
router.get("/users", authenticate, getUsers);
router.delete("/users", authenticate, deleteUser);

module.exports = router;
