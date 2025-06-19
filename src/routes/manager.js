const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authMiddleware");
const upload = require("../config/multerConfig");

const {
  // Auth & Profile
  registerUser,
  loginUser,
  logoutUser,
  checkAuth,
  getProfile,
  getImageProfile,

  // User Management
  getUsers,
  editUser,
  deleteUser,

  // Project Management
  getAllProject,
  addProject,
  editProject,
  deleteProject,
  addUserProject,
  getUserProject,
} = require("../controllers/managerController");

// ────── Auth & Profile Routes ──────
router.post("/user/register", authenticate, registerUser);
router.post("/user/login", loginUser);
router.post("/user/logout", authenticate, logoutUser);
router.get("/user/check-auth", authenticate, checkAuth);
router.get("/user/getprofile", authenticate, getProfile);
router.post("/user/getimageprofile", authenticate, getImageProfile);

// ────── User Management Routes ──────
router.get("/users", authenticate, getUsers);
router.put("/user/edit", authenticate, upload.single("image"), editUser);
router.delete("/user/delete", authenticate, deleteUser);

// ────── Project Management Routes ──────
router.get("/project/all", authenticate, getAllProject); // Admin only
router.post("/project/add", authenticate, addProject); // Admin only
router.put("/project/edit", authenticate, editProject); // Admin only
router.delete("/project/delete", authenticate, deleteProject); // Admin only
router.post("/project/add/users", authenticate, addUserProject); // Admin only
router.post("/project/get/users", authenticate, getUserProject); // Admin only

module.exports = router;
