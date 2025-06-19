const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authMiddleware");
const upload = require("../config/multerConfig");

const {
  getProjectByUser,
  getProjectById,
  addProjectByUser,
  editProjectByUser,
  deleteProjectByUser,
} = require("../controllers/userController");

// ────── Project Routes (User) ──────
router.get("/u/projects", authenticate, getProjectByUser);
router.get("/u/project/:id", authenticate, getProjectById);
router.post("/u/project", authenticate, addProjectByUser);
router.put("/u/project/:id", authenticate, editProjectByUser);
router.delete("/u/project/:id", authenticate, deleteProjectByUser);

module.exports = router;
