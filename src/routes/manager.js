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
  getServiceRequester,
  addServiceRequester,
  deleteServiceRequester,
  getProjectByIdProject,
  getProjectEvaluationById,
  addProjectEvaluation,
  editProjectEvaluation,
  deleteProjectEvaluationById,
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
router.get("/projects/:idProject", authenticate, getProjectByIdProject);
router.post("/projects", authenticate, addProject);
router.put("/projects/edit", authenticate, editProject);
router.delete("/projects/delete", authenticate, deleteProject);
router.post("/projects/add/users", authenticate, addUserProject);
router.post("/projects/get/users", authenticate, getUserProject);

// ────── Project Evaluation / Pengujian Project Routes ──────
router.post("/projects/evaluation", authenticate, addProjectEvaluation);
router.get("/projects/evaluation/:id", authenticate, getProjectEvaluationById);
router.put("/projects/evaluation/:id", authenticate, editProjectEvaluation);
router.delete("/projects/evaluation/:id", authenticate, deleteProjectEvaluationById);

// ────── Service Requester / Peminta Jasa Routes ──────
router.get("/service-requester", authenticate, getServiceRequester);
router.post("/service-requester", authenticate, addServiceRequester);
router.delete("/service-requester/:id", authenticate, deleteServiceRequester);


module.exports = router;
