const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authMiddleware");
const upload = require("../config/multerConfig");

const {
  // Auth
  registerLocal,
  loginLocal,

  // upt & ultg
  getUPT,
  addUPT,
  getULTG,
  addULTG,
  getUnit,
  addUnit,

  // Nodes
  addNode,
  updateNode,
  getNodebyUPT,
  getNodeUPTULTG,
  getNodeUPTULTGunit,

  // Node Sensor Data
  addNodeSensor,
} = require("../controllers/localController");

// ────── Auth Routes ──────
router.post("/signup/local", registerLocal);
router.post("/login/local", loginLocal);

// ────── UPT & ULTG Routes ──────
router.get("/update/upt", authenticate, getUPT);
router.post("/update/upt", authenticate, addUPT);

router.get("/update/ultg", authenticate, getULTG);
router.post("/update/ultg", authenticate, addULTG);

router.post("/update/unit/byupt", authenticate, getUnit);
router.post("/update/unit", authenticate, addUnit);

// ────── Node Management ──────
router.post("/update/node", authenticate, addNode);
router.put("/update/node", authenticate, updateNode);

router.post("/update/node/byupt", authenticate, getNodebyUPT);
router.post("/update/node/byuptultg", authenticate, getNodeUPTULTG);
router.post("/update/node/byuptultgunit", authenticate, getNodeUPTULTGunit);

// ────── Node Sensor Data Upload ──────
router.post(
  "/update/node/data",
  authenticate,
  upload.single("image"),
  addNodeSensor
);

module.exports = router;
