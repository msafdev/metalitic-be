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
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);
router.get("/check-auth", authenticate, checkAuth);
router.get("/get-profile", authenticate, getProfile);
router.post("/get-image-profile", authenticate, getImageProfile);

// ────── User Management Routes ──────
router.get("/users", authenticate, getUsers);
router.put("/user/edit", authenticate, upload.single("image"), editUser);
router.delete("/user/delete", authenticate, deleteUser);

// ────── Project Management Routes ──────
router.get("/projects", authenticate, getAllProject);
router.post("/project/add", authenticate, addProject);
router.put("/project/edit", authenticate, editProject);
router.delete("/project/delete", authenticate, deleteProject);
router.post("/project/add/users", authenticate, addUserProject);
router.post("/project/get/users", authenticate, getUserProject);

module.exports = router;
