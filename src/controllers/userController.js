const sanitize = require("mongo-sanitize");
const User = require("../models/User");
const Project = require("../models/Project");
const Session = require("../models/Session");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const getProjectByUser = async (req, res) => {
  try {
    //! data dati authoMidddleware
    const existingUser = req.existingUser;

    //! jika tidak ditemukan user atau blm di verify dan harus admin dan user
    if (!existingUser || !existingUser.isVerify || existingUser.isSuperAdmin) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let result = await Project.find({ userArrayId: existingUser._id }).select(
      "namaProject permintaanJasa sample tglPengujian lokasiPengujian areaPengujian posisiPengujian material GritSandWhell ETSA kamera mikrosopMerk mikrosopZoom _id"
    );

    if (!Array.isArray(result)) {
      result = [];
    }

    res.status(200).json({ message: result });
  } catch (error) {
    res.status(500).json({ message: "Get Project failed" });
  }
};

const getProjectById = async (req, res) => {
  try {
    const existingUser = req.existingUser;
    const projectId = req.params.id;

    console.log("getProjectById projectId:", projectId);

    if (!existingUser || !existingUser.isVerify || existingUser.isSuperAdmin) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const project = await Project.findById({
      _id: projectId,
    });

    if (!project) {
      return res
        .status(404)
        .json({ message: "Project not found or unauthorized" });
    }

    res.status(200).json({ message: project });
  } catch (error) {
    console.error("getProjectById error:", error);
    res.status(500).json({ message: "Failed to get project" });
  }
};

const addProjectByUser = async (req, res) => {
  try {
    //! data dati authoMidddleware
    const existingUser = req.existingUser;
    const {
      namaProject,
      permintaanJasa,
      sample,
      tglPengujian,
      lokasiPengujian,
      areaPengujian,
      posisiPengujian,
      material,
      GritSandWhell,
      ETSA,
      kamera,
      mikrosopMerk,
      mikrosopZoom,
    } = req.body;

    console.log(req.body);

    //! jika tidak ditemukan user atau blm di verify dan harus admin dan user
    if (!existingUser || !existingUser.isVerify || existingUser.isSuperAdmin) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    //! cek nama project sudah ada atau tidak
    const existingNamaProject = await Project.findOne({
      namaProject: namaProject,
    });
    if (existingNamaProject) {
      return res
        .status(200)
        .json({ status: false, message: "nama projek sudah terdaftar" });
    }

    const [day, month, year] = tglPengujian.split("/");
    const paddedDay = day.padStart(2, "0");
    const paddedMonth = month.padStart(2, "0");
    const convertedDate = new Date(
      `${year}-${paddedMonth}-${paddedDay}T00:00:00Z`
    );

    //! Simpan user ke database
    const newUser = new Project({
      namaProject,
      permintaanJasa,
      sample,
      tglPengujian: convertedDate,
      lokasiPengujian,
      areaPengujian,
      posisiPengujian,
      material,
      GritSandWhell,
      ETSA,
      kamera,
      mikrosopMerk,
      mikrosopZoom,
      userArrayId: [existingUser._id],
    });
    await newUser.save();

    res.status(200).json({ status: true, message: "add project sucess" });
  } catch (error) {
    res.status(500).json({ message: "Add Project failed" });
  }
};

const editProjectByUser = async (req, res) => {
  try {
    //! data dati authoMidddleware
    const existingUser = req.existingUser;
    const {
      id,
      namaProject,
      permintaanJasa,
      sample,
      tglPengujian,
      lokasiPengujian,
      areaPengujian,
      posisiPengujian,
      material,
      GritSandWhell,
      ETSA,
      kamera,
      mikrosopMerk,
      mikrosopZoom,
    } = req.body;

    //! jika tidak ditemukan user atau blm di verify dan harus admin
    if (!existingUser || !existingUser.isVerify || existingUser.isSuperAdmin) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    //! get data project lama
    const oldDataProject = await Project.findOne({
      _id: id,
      userArrayId: existingUser._id,
    });

    //! jika data projek lama tidak ada dan bukan punya user maka tolak
    if (oldDataProject.length === 0) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    console.log("oldDataProject ", oldDataProject.namaProject);

    //! cek nama project sudah ada atau tidak
    const existingNamaProject = await Project.findOne({
      namaProject: namaProject,
    });
    console.log("existingNamaProject ", existingNamaProject?.namaProject);
    if (
      existingNamaProject &&
      existingNamaProject?.namaProject !== oldDataProject?.namaProject
    ) {
      return res.status(200).json({
        status: false,
        message: "Gagal Proses Edit data, nama projek sudah terdaftar",
      });
    }

    const [day, month, year] = tglPengujian.split("/");
    const paddedDay = day.padStart(2, "0");
    const paddedMonth = month.padStart(2, "0");
    const convertedDate = new Date(
      `${year}-${paddedMonth}-${paddedDay}T00:00:00Z`
    );

    // Buat data yang akan diupdate
    const updateData = {
      namaProject,
      permintaanJasa,
      sample,
      tglPengujian: convertedDate,
      lokasiPengujian,
      areaPengujian,
      posisiPengujian,
      material,
      GritSandWhell,
      ETSA,
      kamera,
      mikrosopMerk,
      mikrosopZoom,
    };

    // Update data
    const updatedProject = await Project.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    console.log("updatedProject ", updatedProject);

    res.status(200).json({ status: true, message: "Edit Berhasil" });
  } catch (error) {
    res.status(500).json({ message: "Edit Project failed" });
  }
};

const deleteProjectByUser = async (req, res) => {
  try {
    console.log("DELETE");
    //! data dati authoMidddleware
    const existingUser = req.existingUser;
    const { id } = req.body;

    console.log("id ", id);

    //! jika tidak ditemukan user atau blm di verify dan hanya admin yang boleh edit
    if (!existingUser || !existingUser.isVerify || existingUser.isSuperAdmin) {
      return res.status(401).json({ message: "Unauthorized777" });
    }

    //! get data project lama
    const oldDataProject = await Project.find({
      _id: id,
      userArrayId: existingUser._id,
    });

    //! jika data projek lama tidak ada dan bukan punya user maka tolak
    if (oldDataProject.length === 0) {
      return res.status(401).json({ message: "Unauthorized22" });
    }

    const result = await Project.findByIdAndDelete(id);

    if (!result) {
      return res.status(400).json({ message: "Delete user failed" });
    }

    res.status(200).json({ message: "success" });
  } catch (error) {
    res.status(500).json({ message: "Delete Project failed" });
  }
};

module.exports = {
  getProjectByUser,
  getProjectById,
  addProjectByUser,
  editProjectByUser,
  deleteProjectByUser,
};
