const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authMiddleware");
const upload = require("../config/multerConfig");

const {
  // Auth & Profile
  registerUser,
  loginUser,
  logoutUser,
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
  getPenguji,
  verifyUser,
  getUserById,
  deleteProjectEvaluationImageComponent1,
  deleteProjectEvaluationImageComponent2,
  deleteProjectEvaluationImageListMicroStructure,
  updateProjectEvaluationStatusToPending,
  updateProjectEvaluationStatusToProcessing,
} = require("../controllers/managerController");

const editProjectEvaluationUpload = upload.fields([
  { name: "gambarKomponent1", maxCount: 1 },
  { name: "gambarKomponent2", maxCount: 1 },
  { name: "listGambarStrukturMikro" }, // atau berapa maksimal file yang diperbolehkan
]);

const userUpload = upload.fields([{ name: "avatarUser", maxCount: 1 }]);

// ────── Auth & Profile Routes ──────
router.post("/register", authenticate, userUpload, registerUser);
router.post("/login", loginUser);
router.post("/logout", authenticate, logoutUser);
router.post("/get-image-profile", authenticate, getImageProfile);

// ────── User Management Routes ──────
router.get("/users", authenticate, getUsers);
router.get("/penguji", authenticate, getPenguji);
router.get("/user/:id", authenticate, getUserById);
router.put("/user/:id", authenticate, userUpload, editUser);
router.delete("/user/delete", authenticate, deleteUser);
router.post("/user/verify", authenticate, verifyUser);

// ────── Project Management Routes ──────
router.get("/projects", authenticate, getAllProject);
router.get("/projects/:idProject", authenticate, getProjectByIdProject);
router.post("/projects", authenticate, addProject);
router.put("/projects/edit", authenticate, editProject);
router.delete("/project/delete", authenticate, deleteProject);
router.post("/projects/add/users", authenticate, addUserProject);
router.post("/projects/get/users", authenticate, getUserProject);

// ────── Project Evaluation / Pengujian Project Routes ──────
router.post("/projects/evaluation", authenticate, addProjectEvaluation);
router.get("/projects/evaluation/:id", authenticate, getProjectEvaluationById);
router.put(
  "/projects/evaluation/:id",
  authenticate,
  editProjectEvaluationUpload,
  editProjectEvaluation
);
router.put("/projects/evaluation/:id/status/pending", updateProjectEvaluationStatusToPending);
router.put("/projects/evaluation/:id/status/processing", authenticate, updateProjectEvaluationStatusToProcessing);
router.delete(
  "/projects/evaluation/:id",
  authenticate,
  deleteProjectEvaluationById
);
router.delete("/projects/evaluation/:id/image-component-1", authenticate, deleteProjectEvaluationImageComponent1);
router.delete("/projects/evaluation/:id/image-component-2", authenticate, deleteProjectEvaluationImageComponent2);
router.delete("/projects/evaluation/:id/image-list-micro-structure", authenticate, deleteProjectEvaluationImageListMicroStructure);

// ────── Service Requester / Peminta Jasa Routes ──────
router.get("/service-requester", authenticate, getServiceRequester);
router.post("/service-requester", authenticate, addServiceRequester);
router.delete("/service-requester/:id", authenticate, deleteServiceRequester);

module.exports = router;
