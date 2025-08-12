require('dotenv').config
const sanitize = require("mongo-sanitize");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const User = require("../models/User");
const Session = require("../models/Session");
const Project = require("../models/Project");
const Sample = require("../models/Sample");
const ServiceRequester = require("../models/ServiceRequester");
const ProjectEvaluation = require("../models/ProjectEvaluation");
const { getAssetURL } = require("../utils/assets");
const AnalyzedResult = require("../models/AnalyzedResult");
const Ai_Model = require("../models/Ai_Model");
const axios = require("axios");
const FormData = require('form-data');

// Helpers
const hashPassword = async (password) => await bcrypt.hash(password, 10);
const verifyPassword = async (input, hash) => await bcrypt.compare(input, hash);
const Ai_model = new Ai_Model({
  namaModel: 'degradasi d3',
  namaPembuat: 'Fairuz',
  jenisModel: 'degradasi',
  fileName: 'degradasi d3.zip',
  notes: 'degradasi d3'
});
// Ai_model.save();


const makeUrl = (filename) => {
  const folder = process.env.UPLOAD_FOLDER || "uploads";
  return `/${folder}/${filename}`;
};

const isUnauthorized = (user) => {
  !user || !user.isVerify || !user.isAdmin;
};

// Controller: Register
const registerUser = async (req, res) => {
  try {
    // const tes=AiModel()
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      username,
      password,
      name,
      nomorInduk,
      devisi,
      jabatan,
      email,
      noHp,
      alamat,
      isAdmin,
    } = req.body;

    const files = req.files;

    const duplicateChecks = await Promise.all([
      User.findOne({ username }),
      User.findOne({ nomorInduk }),
      User.findOne({ email: { $regex: `^${email}$`, $options: "i" } }),
      User.findOne({ noHp }),
    ]);

    if (duplicateChecks[0])
      return res.json({ status: false, message: "Username sudah digunakan" });
    if (duplicateChecks[1])
      return res.json({
        status: false,
        message: "Nomor Induk sudah digunakan",
      });
    if (duplicateChecks[2])
      return res.json({ status: false, message: "Email sudah digunakan" });
    if (duplicateChecks[3])
      return res.json({ status: false, message: "Nomor HP sudah digunakan" });

    const hashedPassword = await hashPassword(password);

    const avatarUserUrl =
      files?.avatarUser?.[0] && makeUrl(files.avatarUser[0].filename);

    const newUser = new User({
      username,
      password: hashedPassword,
      name,
      nomorInduk,
      devisi,
      jabatan,
      email,
      noHp,
      alamat,
      projects: [],
      avatarUser: avatarUserUrl,
      isSuperAdmin: false,
      isAdmin,
      isVerify: false,
    });

    await newUser.save();

    res.status(200).json({ status: true, message: "Registrasi user berhasil" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Register failed" });
  }
};

// Controller: Login
const loginUser = async (req, res) => {
  try {
    const username = sanitize(req.body.username);
    const password = req.body.password;
    const user = await User.findOne({ username });

    if (!user || !user.isVerify || user.isSuperAdmin) {
      return res.status(400).json({ message: "Login failed" });
    }

    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Akun atau password salah" });
    }

    const isManager = user.isAdmin;
    const secret = isManager
      ? process.env.JWT_SECRET_MANAGER
      : process.env.JWT_SECRET;
    const role = isManager ? "supervisor" : "user";
    const token = jwt.sign({ username }, secret, { expiresIn: "1h" });

    await Session.deleteMany({ userId: user._id });
    await new Session({ userId: user._id, token }).save();

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      maxAge: 3600000,
    });

    res.cookie("role", role, {
      httpOnly: false,
      secure: true,
      sameSite: "Strict",
      maxAge: 3600000,
    });

    res
      .status(200)
      .json({ message: `Login ${isManager ? "Manager" : "User"} berhasil` });
  } catch (err) {
    res.status(500).json({ message: "Login failed" });
  }
};

// Controller: Logout
const logoutUser = async (req, res) => {
  try {
    const user = req.existingUser;

    await Session.deleteOne({ userId: user._id });

    res.clearCookie("token");
    res.clearCookie("role");
    res.status(200).json({ message: "Logout berhasil" });
  } catch (err) {
    res.status(500).json({ message: "Logout gagal" });
  }
};

// Controller: Get all users (admin only)
const getUsers = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let query = {};

    if (user.isSuperAdmin === false) {
      query.isSuperAdmin = false;
    }

    const users = await User.find(query).select(
      "avatarUser username name nomorInduk devisi jabatan email noHp alamat isVerify isSuperAdmin isAdmin filename _id"
    );

    res.status(200).json({
      message: "Get users success",
      data: users.map((user) => ({
        ...user.toObject(),
        role: user.isSuperAdmin
          ? "superadmin"
          : user.isAdmin
            ? "supervisor"
            : "user",
      })),
    });
  } catch (err) {
    res.status(500).json({ message: "Get users failed" });
  }
};

// Controller: Get all users (admin only)
const getUserById = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const users = await User.findOne({
      _id: id,
    })
      .select(
        "avatarUser username name nomorInduk devisi jabatan email noHp alamat filename filepath isVerify isSuperAdmin isAdmin filename _id projects"
      )
      .populate({
        path: "projects",
        select:
          "_id idProject namaProject pemintaJasa tanggalOrderMasuk createdAt updatedAt",
      })
      .lean();

    res.status(200).json({
      message: "Get user by id success",
      data: {
        ...users,
        role: users.isSuperAdmin
          ? "superadmin"
          : users.isAdmin
            ? "supervisor"
            : "user",
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Get user by id failed" });
  }
};

// Controller: Get all penguji (admin only)
const getPenguji = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const users = await User.find({
      isSuperAdmin: false,
      isAdmin: false,
    }).select(
      "username name nomorInduk devisi jabatan email noHp alamat filename _id"
    );

    res.status(200).json({
      message: "Get penguji success",
      data: users,
    });
  } catch (err) {
    res.status(500).json({ message: "Get users failed" });
  }
};

// Controller: Verify user (admin only)
const verifyUser = async (req, res) => {
  try {
    const existingUser = req.existingUser;

    const usernameVerify = req.body.username;
    const isVerify = req.body.isVerify;

    if (!existingUser || !existingUser.isAdmin) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (existingUser.isAdmin) {
      const updatedUser = await User.findOneAndUpdate(
        { username: usernameVerify },
        { isVerify: isVerify },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(404).json({ message: "User tidak ditemukan" });
      }
    } else {
      return res.status(401).json({ message: "Unauthorized" });
    }

    res.status(200).json({ message: "verifikasi user berhasil" });
  } catch (error) {
    res.status(500).json({ message: "Unauthorized" });
  }
};

// Controller: Edit user
const editUser = async (req, res) => {
  try {
    const user = req.existingUser;
    const id = req.params.id;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      username,
      name,
      nomorInduk,
      devisi,
      jabatan,
      email,
      noHp,
      alamat,
      isAdmin,
    } = req.body;

    const files = req.files;

    const avatarUserUrl =
      files?.avatarUser?.[0] && makeUrl(files.avatarUser[0].filename);

    const updatedFields = {
      username,
      name,
      devisi,
      jabatan,
      email,
      noHp,
      nomorInduk,
      alamat,
      isAdmin,
      avatarUser: avatarUserUrl,
    };

    const updatedUser = await User.findByIdAndUpdate(id, updatedFields, {
      new: true,
    });

    if (req.file && user.filepath) {
      fs.unlink(path.resolve(user.filepath), (err) => {
        if (!err) console.log("Old file deleted");
      });
    }

    res.status(200).json({ message: "Edit berhasil" });
  } catch (err) {
    res.status(500).json({ message: "Edit failed" });
  }
};

// Controller: Delete user
const deleteUser = async (req, res) => {
  try {
    const admin = req.existingUser;
    const { id } = req.body;

    if (isUnauthorized(admin)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(id);
    if (!user || user.isSuperAdmin || user.isAdmin) {
      return res.status(400).json({ message: "Delete user failed" });
    }

    await User.findByIdAndDelete(id);

    if (user.filepath) {
      fs.unlink(path.resolve(user.filepath), (err) => {
        if (!err) console.log("User file deleted");
      });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Delete user failed" });
  }
};

// Controller: Get profile image
const getImageProfile = async (req, res) => {
  try {
    const admin = req.existingUser;
    const { id, filename } = req.body;

    if (isUnauthorized(admin)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findOne({ _id: id, filename });
    if (!user) {
      return res.status(400).json({ message: "Unauthorized" });
    }

    const filePath = path.resolve(user.filepath);
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ message: "File not found" });
    }

    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ message: "Get image profile failed" });
  }
};

// Controller: Get all projects (admin only)
const getAllProject = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let query = {};

    if (!user.isSuperAdmin && !user.isAdmin) {
      query = { penguji: user._id };
    }

    const projects = await Project.find(query).select(
      "_id idProject namaProject pemintaJasa tanggalOrderMasuk createdAt updatedAt penguji"
    );

    res.status(200).json({
      data: projects,
      message: "Get all project success",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Get Project failed" });
  }
};

const getProjectByIdProject = async (req, res) => {
  try {
    const user = req.existingUser;
    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { idProject } = req.params;

    const [project, projectEvaluations] = await Promise.all([
      Project.findOne({ idProject })
        .populate("penguji", "_id name jabatan") // populate data user
        .lean(),
      ProjectEvaluation.find({ projectId: idProject }).lean(),
    ]);

    const projectEvaluationsWithProgress = projectEvaluations.map(
      (evaluation) => {
        const { progress, missingFields } = calculateProgressWithMissingFields(
          evaluation,
          ProjectEvaluation.schema
        );

        return {
          ...evaluation,
          progress,
          missingFields,
        };
      }
    );

    res.status(200).json({
      status: true,
      data: {
        ...project,
        pengujian: projectEvaluationsWithProgress || [],
      },
      message: "Get detail project success",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Get Project failed" });
  }
};

// Controller: Add project
const addProject = async (req, res) => {
  try {
    const user = req.existingUser;
    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { namaProject, pemintaJasa, tanggalOrderMasuk, penguji } = req.body;

    const existingProject = await Project.findOne({ namaProject });

    if (existingProject) {
      return res.status(400).json({ message: "Project sudah terdaftar" });
    }

    const idProject = `MTL-${String(Math.floor(Math.random() * 1000)).padStart(
      3,
      "0"
    )}`;

    const newProject = new Project({
      idProject,
      namaProject,
      pemintaJasa,
      tanggalOrderMasuk,
      penguji, // langsung array of ObjectId
    });

    await newProject.save();

    // Tambahkan projectId ke masing-masing user
    await User.updateMany(
      { _id: { $in: penguji } },
      { $addToSet: { projects: newProject._id } }
    );

    res.status(200).json({
      status: true,
      message: "Project berhasil ditambahkan",
      data: newProject,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Add Project failed" });
  }
};

// Controller: Edit project
const editProject = async (req, res) => {
  try {
    const user = req.existingUser;
    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { namaProject, pemintaJasa, tanggalOrderMasuk, penguji } = req.body;
    const id = req.params.id;

    const existingProject = await Project.findOne({ idProject: id });
    if (!existingProject) {
      return res.status(404).json({ message: "Project tidak ditemukan" });
    }

    const duplicateProject = await Project.findOne({ namaProject });
    if (
      duplicateProject &&
      duplicateProject._id.toString() !== existingProject._id.toString()
    ) {
      return res
        .status(400)
        .json({ message: "Edit gagal, nama project sudah digunakan" });
    }

    // Hitung perubahan penguji
    const oldPenguji = existingProject.penguji.map((p) => p.toString());
    const newPenguji = penguji;

    const toAdd = newPenguji.filter((id) => !oldPenguji.includes(id));
    const toRemove = oldPenguji.filter((id) => !newPenguji.includes(id));

    // Update Project
    const updated = await Project.findOneAndUpdate(
      { idProject: id },
      {
        namaProject,
        pemintaJasa,
        tanggalOrderMasuk,
        penguji: newPenguji,
      },
      { new: true }
    );

    // Update users
    await User.updateMany(
      { _id: { $in: toAdd } },
      { $addToSet: { projects: updated._id } }
    );

    await User.updateMany(
      { _id: { $in: toRemove } },
      { $pull: { projects: updated._id } }
    );

    res
      .status(200)
      .json({ status: true, message: "Edit berhasil", data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Edit Project failed" });
  }
};

// Controller: Delete project
const deleteProject = async (req, res) => {
  try {
    const user = req.existingUser;
    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: "Project tidak ditemukan" });
    }

    // Hapus project ID dari user
    await User.updateMany(
      { _id: { $in: project.penguji } },
      { $pull: { projects: project._id } }
    );

    const deleted = await Project.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(400).json({ message: "Gagal menghapus proyek" });
    }

    res.status(200).json({ message: "Berhasil menghapus proyek" });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan saat menghapus proyek" });
  }
};

const addUserProject = async (req, res) => {
  try {
    //! data dati authoMidddleware
    const existingUser = req.existingUser;
    let { id, userId } = req.body;

    //! jika tidak ditemukan user atau blm di verify dan hanya admin yang boleh edit
    if (
      !existingUser ||
      !existingUser.isVerify ||
      existingUser.isSuperAdmin ||
      !existingUser.isAdmin
    ) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!Array.isArray(userId)) {
      userId = [];
    }

    //! cek apakah semua user terdaftar
    const foundDocs = await User.find({ _id: { $in: userId } });

    //! jika semua user terdaftar masukan pada UserArrayId
    if (foundDocs && foundDocs.length === userId.length) {
      // Buat data yang akan diupdate
      const updateData = {
        userArrayId: userId,
      };
      // Update data
      const updatedProject = await Project.findByIdAndUpdate(id, updateData, {
        new: true,
      });

      return res
        .status(200)
        .json({ message: "Data user berhasil ditambahkan" });
    }

    return res.status(400).json({ message: "Data User tidak valid" });
  } catch (error) {
    res.status(500).json({ message: "Add Data user failed" });
  }
};

const getUserProject = async (req, res) => {
  try {
    //! data dati authoMidddleware
    const existingUser = req.existingUser;
    let { id } = req.body;

    //! jika tidak ditemukan user atau blm di verify dan hanya admin yang boleh edit
    if (
      !existingUser ||
      !existingUser.isVerify ||
      existingUser.isSuperAdmin ||
      !existingUser.isAdmin
    ) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    //! cek apakah semua user terdaftar
    const foundProject = await Project.findById(id).select("userArrayId -_id");

    if (foundProject) {
      return res.status(200).json({ message: foundProject.userArrayId });
    }

    return res.status(400).json({ message: "Data tidak ditemukan" });
  } catch (error) {
    res.status(500).json({ message: "Get Data user failed" });
  }
};

const getServiceRequester = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const result = await ServiceRequester.find();

    res.status(200).json({
      status: true,
      message: "Get all service requester success",
      data: result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const addServiceRequester = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { nama } = req.body;

    const existingServiceRequester = await ServiceRequester.findOne({ nama });

    if (existingServiceRequester) {
      return res.status(400).json({
        status: false,
        message: "Peminta Jasa sudah terdaftar",
      });
    }

    const newServiceRequester = new ServiceRequester({
      nama,
    });

    await newServiceRequester.save();

    res.status(200).json({
      status: true,
      message: "Project berhasil ditambahkan",
      data: newServiceRequester,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
};

const deleteServiceRequester = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const existingServiceRequester = await ServiceRequester.findById(id);

    if (!existingServiceRequester) {
      return res.status(400).json({
        status: false,
        message: "Peminta Jasa tidak ditemukan",
      });
    }

    await ServiceRequester.findByIdAndDelete(id);

    res.status(200).json({
      status: true,
      message: "Peminta Jasa berhasil dihapus",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
};

const addProjectEvaluation = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      id,
      projectId,
      nama,
      tanggal,
      lokasi,
      area,
      posisi,
      material,
      gritSandWhell,
      etsa,
      kamera,
      merkMikroskop,
      perbesaranMikroskop,
      gambarKomponent1,
      gambarKomponent2,
      listGambarStrukturMikro,
      aiModelFasa,
      aiModelCrack,
      aiModelDegradasi,
    } = req.body;

    const existingProjectEvaluation = await ProjectEvaluation.findOne({ id });

    if (existingProjectEvaluation) {
      return res.status(400).json({
        status: false,
        message: `Pengujian Project dengan id ${id} sudah terdaftar`,
      });
    }

    const newProjectEvaluation = new ProjectEvaluation({
      id,
      projectId,
      status: "DRAFT",
      nama,
      tanggal,
      lokasi,
      area,
      posisi,
      material,
      gritSandWhell,
      etsa,
      kamera,
      merkMikroskop,
      perbesaranMikroskop,
      gambarKomponent1,
      gambarKomponent2,
      listGambarStrukturMikro,
      aiModelFasa,
      aiModelCrack,
      aiModelDegradasi,
    });

    await newProjectEvaluation.save();

    res.status(200).json({
      status: true,
      message: "Pengujian Project berhasil ditambahkan",
      data: newProjectEvaluation,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
};

const editProjectEvaluation = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      id,
      projectId,
      nama,
      tanggal,
      lokasi,
      area,
      posisi,
      material,
      gritSandWhell,
      etsa,
      kamera,
      merkMikroskop,
      perbesaranMikroskop,
      aiModelFasa,
      aiModelCrack,
      aiModelDegradasi,
    } = req.body;

    const files = req.files;

    const existingProjectEvaluation = await ProjectEvaluation.findOne({ id });
    if (!existingProjectEvaluation) {
      return res.status(400).json({
        status: false,
        message: `Pengujian Project dengan id ${id} tidak ditemukan`,
      });
    }

    const gambar1Url = files?.gambarKomponent1?.[0]
      ? makeUrl(files.gambarKomponent1[0].filename)
      : existingProjectEvaluation.gambarKomponent1;

    const gambar2Url = files?.gambarKomponent2?.[0]
      ? makeUrl(files.gambarKomponent2[0].filename)
      : existingProjectEvaluation.gambarKomponent2;

    const strukturUrls = files?.listGambarStrukturMikro
      ? files.listGambarStrukturMikro.map((file) => makeUrl(file.filename))
      : existingProjectEvaluation.listGambarStrukturMikro;

    // Update data
    Object.assign(existingProjectEvaluation, {
      projectId,
      nama,
      tanggal,
      lokasi,
      area,
      posisi,
      material,
      gritSandWhell,
      etsa,
      kamera,
      merkMikroskop,
      perbesaranMikroskop,
      gambarKomponent1: gambar1Url,
      gambarKomponent2: gambar2Url,
      listGambarStrukturMikro: strukturUrls,
      aiModelFasa,
      aiModelCrack,
      aiModelDegradasi,
    });

    await existingProjectEvaluation.save();

    const { progress } = calculateProgressWithMissingFields(
      existingProjectEvaluation,
      ProjectEvaluation.schema
    );

    if (progress === 100) {
      existingProjectEvaluation.status = "COMPLETED";
    } else if (progress > 6) {
      existingProjectEvaluation.status = "PROCESSING";
    }

    await existingProjectEvaluation.save();

    const result = existingProjectEvaluation.toObject();

    res.status(200).json({
      message: "Pengujian Project berhasil diubah",
      data: {
        ...result,
        gambarKomponent1: result.gambarKomponent1 ? getAssetURL(result.gambarKomponent1) : null,
        gambarKomponent2: result.gambarKomponent2 ? getAssetURL(result.gambarKomponent2) : null,
        listGambarStrukturMikro: result.listGambarStrukturMikro.map(
          (gambar) => getAssetURL(gambar)
        ),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

const updateProjectEvaluationStatusToPending = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const existingProjectEvaluation = await ProjectEvaluation.findOne({ id });
    if (!existingProjectEvaluation) {
      return res.status(400).json({
        status: false,
        message: `Pengujian Project dengan id ${id} tidak ditemukan`,
      });
    }

    existingProjectEvaluation.status = "PENDING";

    await existingProjectEvaluation.save();

    res.status(200).json({
      message: "Pengujian Project berhasil diubah",
      data: existingProjectEvaluation,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

const updateProjectEvaluationStatusToProcessing = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const existingProjectEvaluation = await ProjectEvaluation.findOne({ id });
    if (!existingProjectEvaluation) {
      return res.status(400).json({
        status: false,
        message: `Pengujian Project dengan id ${id} tidak ditemukan`,
      });
    }

    existingProjectEvaluation.status = "PROCESSING";
    existingProjectEvaluation.lastActive = Date.now();

    await existingProjectEvaluation.save();

    res.status(200).json({
      message: "Pengujian Project berhasil diubah",
      data: existingProjectEvaluation,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

const calculateProgressWithMissingFields = (data, modelSchema) => {
  const excludedFields = [
    "_id",
    "__v",
    "createdAt",
    "updatedAt",
    "id",
    "projectId",
    "status",
  ];
  const schemaFields = Object.keys(modelSchema.paths).filter(
    (field) => !excludedFields.includes(field)
  );

  const totalFields = schemaFields.length;
  const missingFields = [];

  const filledFields = schemaFields.filter((field) => {
    const value = data[field];

    const isFilled = Array.isArray(value)
      ? value.length > 0
      : value !== undefined && value !== null && value !== "";

    if (!isFilled) {
      // Bisa disesuaikan dengan mapping label bahasa Indonesia jika perlu
      missingFields.push(field);
    }

    return isFilled;
  });

  const progress = Math.round((filledFields.length / totalFields) * 100);

  return { progress, missingFields };
};

const getProjectEvaluationById = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const existingProjectEvaluation = await ProjectEvaluation.findOne({
      id,
    }).lean();

    if (!existingProjectEvaluation) {
      return res.status(400).json({
        status: false,
        message: `Pengujian Project dengan id ${id} tidak ditemukan`,
      });
    }

    const project = await Project.findOne({
      idProject: existingProjectEvaluation.projectId,
    })
      .select("idProject namaProject pemintaJasa tanggalOrderMasuk penguji")
      .lean();

    const { progress, missingFields } = calculateProgressWithMissingFields(
      existingProjectEvaluation,
      ProjectEvaluation.schema
    );

    res.status(200).json({
      status: true,
      message: "Pengujian Project berhasil ditemukan",
      data: {
        ...existingProjectEvaluation,
        project,
        progress,
        missingFields,
        gambarKomponent1: existingProjectEvaluation.gambarKomponent1
          ? getAssetURL(existingProjectEvaluation.gambarKomponent1)
          : null,
        gambarKomponent2: existingProjectEvaluation.gambarKomponent2
          ? getAssetURL(existingProjectEvaluation.gambarKomponent2)
          : null,
        listGambarStrukturMikro:
          existingProjectEvaluation.listGambarStrukturMikro.map((gambar) =>
            getAssetURL(gambar)
          ),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getAiModelList = async (req, res) => {
  try {
    const models = await Ai_Model.find()
    // const namaModels=models.map(m=>m.namaModel)
    console.log(models)
    // ===== TODO: Untuk data dropdown di FE page Pengujian =======
    // aiModels bisa di get dari database / folder / file / sesuai kebutuhan, kode dibawah ini hanya contoh / template
    //clear dev 21072025 1322

    const aiModels = {
      fasa: models.filter(m => m.jenisModel === 'fasa').map(m => m.namaModel),
      crack: models.filter(m => m.jenisModel === 'crack').map(m => m.namaModel),
      degradasi: models.filter(m => m.jenisModel === 'degradasi').map(m => m.namaModel)
    }

    res.status(200).json({
      status: true,
      message: "Get all ai model success",
      data: aiModels
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
}

const getAiClasificationList = async (req, res) => {
  try {
    // ===== TODO: Untuk data dropdown di FE page Update Analyzed Result =======
    // aiModels bisa di get dari database / folder / file / sesuai kebutuhan, kode dibawah ini hanya contoh / template
    // sementara static
    const aiModels = {
      fasa: [
        "Austenite", "Martensite", "Ferrite", "Bainite"
      ],
      crack: [
        "Terdeteksi", "Tidak Terdeteksi"
      ],
      degradasi: [
        "ERA A", "ERA B", "ERA C", "ERA D"
      ]
    }

    res.status(200).json({
      status: true,
      message: "Get all ai clasification success",
      data: aiModels
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
}

const deleteProjectEvaluationById = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const existingProjectEvaluation = await ProjectEvaluation.findOne({ id });

    if (!existingProjectEvaluation) {
      return res.status(400).json({
        status: false,
        message: `Pengujian Project dengan id ${id} tidak ditemukan`,
      });
    }

    await ProjectEvaluation.findByIdAndDelete(id);

    res.status(200).json({
      status: true,
      message: "Pengujian Project berhasil dihapus",
      data: existingProjectEvaluation,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
};

const deleteProjectEvaluationImageComponent1 = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const existingProjectEvaluation = await ProjectEvaluation.findOne({ id });

    if (!existingProjectEvaluation) {
      return res.status(400).json({
        status: false,
        message: `Pengujian Project dengan id ${id} tidak ditemukan`,
      });
    }

    existingProjectEvaluation.gambarKomponent1 = null;

    await existingProjectEvaluation.save();

    res.status(200).json({
      status: true,
      message: "Gambar Komponen 1 Pengujian berhasil dihapus",
      data: existingProjectEvaluation,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
};

const deleteProjectEvaluationImageComponent2 = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const existingProjectEvaluation = await ProjectEvaluation.findOne({ id });

    if (!existingProjectEvaluation) {
      return res.status(400).json({
        status: false,
        message: `Pengujian Project dengan id ${id} tidak ditemukan`,
      });
    }

    existingProjectEvaluation.gambarKomponent2 = null;

    await existingProjectEvaluation.save();

    res.status(200).json({
      status: true,
      message: "Gambar Komponen 1 Pengujian berhasil dihapus",
      data: existingProjectEvaluation,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
};

const deleteProjectEvaluationImageListMicroStructure = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;

    const existingProjectEvaluation = await ProjectEvaluation.findOne({ id });

    if (!existingProjectEvaluation) {
      return res.status(400).json({
        status: false,
        message: `Pengujian Project dengan id ${id} tidak ditemukan`,
      });
    }

    existingProjectEvaluation.listGambarStrukturMikro = [];

    await existingProjectEvaluation.save();

    res.status(200).json({
      status: true,
      message: "List Gambar Struktur Mikro Pengujian berhasil dihapus",
      data: existingProjectEvaluation,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
};

const hitMetalyticserve = async (filename, mode) => {
  let urlMode;

  const aiMicroserviceBaseUrl = process.env.AI_MICROSERVICE_API;

  if (mode === "fasa") {
    urlMode = `${aiMicroserviceBaseUrl}/predict?task_type=fasa`;
  } else if (mode === "crack") {
    urlMode = `${aiMicroserviceBaseUrl}/predict?task_type=crack`;
  } else if (mode === "degradation") {
    urlMode = `${aiMicroserviceBaseUrl}/predict?task_type=degradation`;
  } else {
    throw new Error(`Invalid mode: ${mode}`);
  }

  const imageName = path.basename(filename);
  const localFilePath = path.resolve(
    process.env.BASEDIR_STATIC,
    process.env.UPLOAD_FOLDER,
    imageName
  );
  console.log(`req local: ${localFilePath}`);

  const data = new FormData();
  data.append("image", fs.createReadStream(localFilePath));

  const config = {
    method: "post",
    maxBodyLength: Infinity,
    url: urlMode,
    headers: data.getHeaders(), // Correct way to set multipart headers
    data: data,
  };

  try {
    let response = await axios.request(config);
    let predicted;

    if (mode === "fasa") { predicted = response.data[`${mode}_results`]?.predicted_class; }
    else if (mode === "crack") { predicted = response.data[`${mode}_results`]?.details.objects_detected; }
    else if (mode === "degradation") { predicted = response.data[`${mode}_results`]?.predicted_class; }

    let confidence;
    if (mode === "fasa") { confidence = response.data[`${mode}_results`]?.probability; }
    else if (mode === "crack") { confidence = 100; } // anggap crack confidence nya 100%
    else if (mode === "degradation") { confidence = response.data[`${mode}_results`]?.probability; }

    let image;
    if (mode === "fasa") { image = response.data[`${mode}_results`]?.image_base64; }
    else if (mode === "crack") { image = response.data[`${mode}_results`]?.image_base64; }
    else if (mode === "degradation") { image = response.data[`${mode}_results`]?.image_base64; }

    console.log(`Predicted class ${mode}: ${predicted}`);
    return {
      predicted,
      confidence,
      image
    };
  } catch (error) {
    console.error("Error hitting AI API:", error.message);
    return null;
  }
}

const getMostFrequentPrediction = (results) => {
  const countMap = {};

  // Hitung jumlah kemunculan tiap predicted
  for (const item of results) {
    countMap[item.predicted] = (countMap[item.predicted] || 0) + 1;
  }

  // Cari predicted dengan jumlah terbanyak
  let mostFrequent = null;
  let maxCount = 0;

  for (const [predicted, count] of Object.entries(countMap)) {
    if (count > maxCount) {
      mostFrequent = predicted;
      maxCount = count;
    }
  }

  return {
    prediction: mostFrequent,
    count: maxCount,
  };
}

const getCrackConclusion = (results) => {
  const hasCrack = results.some(item => item.predicted > 0);
  return hasCrack ? "terdeteksi microcrack" : "tidak terdeteksi microcrack";
}

const analyzeProjectEvaluationWithAIExternalAPI = async (req, user) => {
  // ====== TODO: HIT AI EXTERNAL API ======
  // disini seharusnya anda hit endpoint AI external API, dibawah disimulasi dengan me return contoh data response dari AI external API

  // console.log(`req: ${JSON.stringify(req.listGambarStrukturMikro,0,2)}`);
  // const filenames = path.basename(req.listGambarStrukturMikro);
  // console.log('tes',filenames);

  const responsesFasa = [];
  const responsesCrack = [];
  const responsesDegradasi = [];
  console.log("list gambar struktur mikro:", req.listGambarStrukturMikro);
  for (const filename of req.listGambarStrukturMikro) {
    responsesFasa.push(hitMetalyticserve(filename, 'fasa'));
    responsesCrack.push(hitMetalyticserve(filename, 'crack'));
    responsesDegradasi.push(hitMetalyticserve(filename, 'degradation'));

  }
  const fasaResults = await Promise.all(responsesFasa);
  const crackResults = await Promise.all(responsesCrack);
  const degradasiResults = await Promise.all(responsesDegradasi);

  // console.log('response fasa:',responsesFasa);
  // console.log('response crack:',responsesCrack);
  // console.log('response degradasi:',responsesDegradasi);

  req.listGambarStrukturMikro.forEach((filename, index) => {
    console.log(`Image: ${filename}`);
    console.log(`  Fasa: ${fasaResults[index].predicted}`);
    console.log(`  Crack: ${crackResults[index].predicted}`);
    console.log(`  Degradasi: ${degradasiResults[index].predicted}`);
  });

  const currentDate = new Date().toISOString().split("T")[0];

  return {
    hasilAnalisa: req.listGambarStrukturMikro.map((item, index) => ({
      image: item,
      fasa: {
        image: `data:image/jpeg;base64,${fasaResults[index].image}`,
        penguji: user.name,
        tanggalUpdate: currentDate,
        mode: "AI", // AI | MANUAL
        hasilKlasifikasiAI: fasaResults[index].predicted, // Digunakan saat mode === "AI"
        modelAI: req.aiModelFasa,
        confidence: fasaResults[index].confidence * 100, // ubah ke persen dikali 100
        hasilKlasifikasiManual: null // string | null  // Digunakan saat mode === "MANUAL"
      },
      crack: {
        image: `data:image/jpeg;base64,${crackResults[index].image}`,
        penguji: user.name,
        tanggalUpdate: currentDate,
        mode: "AI", // AI | MANUAL
        hasilKlasifikasiAI: crackResults[index].predicted,  // Digunakan saat mode === "AI"
        modelAI: req.aiModelCrack,
        confidence: crackResults[index].confidence,
        hasilKlasifikasiManual: null // string | null  // Digunakan saat mode === "MANUAL"
      },
      degradasi: {
        image: `data:image/jpeg;base64,${degradasiResults[index].image}`,
        penguji: user.name,
        tanggalUpdate: currentDate,
        mode: "AI", // AI | MANUAL
        hasilKlasifikasiAI: degradasiResults[index].predicted, // Digunakan saat mode === "AI"
        modelAI: req.aiModelDegradasi,
        confidence: degradasiResults[index].confidence * 100,  // ubah ke persen dikali 100
        hasilKlasifikasiManual: null // string | null  // Digunakan saat mode === "MANUAL"
      }
    })),
    kesimpulan: {
      strukturMikro: getMostFrequentPrediction(fasaResults).prediction,
      fiturMikroskopik: getCrackConclusion(crackResults),
      damageClass: getMostFrequentPrediction(degradasiResults).prediction,
      hardness: "-",
      rekomendasi: "-",
    },
  }
}

const analyzeProjectEvaluation = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const requestBody = req.body;
    // contoh isi dari requestBody dari FE
    // {
    //   projectEvaluationId: "MTL-062-001",
    //   projectId: "MTL-062",
    //   nama: "Pengujian 1",
    //   listGambarStrukturMikro: [
    //     "http://localhost:1945/uploads/20250705_145233_jxjar.jpg",
    //     "http://localhost:1945/uploads/20250705_145233_isude8.png",
    //     "http://localhost:1945/uploads/20250705_145233_1xlum6.png",
    //     "http://localhost:1945/uploads/20250705_145233_or2858.png",
    //     "http://localhost:1945/uploads/20250705_145233_ahn0lu.png"
    //   ],
    //   aiModelCrack: "Crack 2",
    //   aiModelDegradasi: "Degradasi 1",
    //   aiModelFasa: "Fasa 1",
    //   area: "sekolah",
    //   etsa: "ETSA",
    //   gritSandWhell: "GSW",
    //   kamera: "Cam",
    //   lokasi: "Semarang",
    //   material: "material test",
    //   merkMikroskop: "merk ",
    //   perbesaranMikroskop: "4x",
    //   posisi: "test posisi",
    //   tanggal: "2025-07-05",
    //   gambarKomponent1: "http://localhost:1945/uploads/20250705_145233_8s21g6.jpg",
    //   gambarKomponent2: "http://localhost:1945/uploads/20250705_145233_91t8ld.png",
    // }

    const existingProjectEvaluation = await ProjectEvaluation.findOne({ id });

    if (!existingProjectEvaluation) {
      return res.status(400).json({
        status: false,
        message: `Pengujian Project dengan id ${id} tidak ditemukan`,
      });
    }

    // ======= TODO: Untuk Proses Analisa Pengujian Project ============
    // proses hit API External untuk Analisa AI Model nya bisa dilakukan dibawah ini 
    const existingProject = await Project.findOne({ idProject: requestBody.projectId, }).populate({
      path: "penguji",
      select: "name email",
    });

    // 1. ambil data dari request body untuk di hit ke API External
    const requestBodyForApiExternal = {
      nama: requestBody.nama,
      listGambarStrukturMikro: requestBody.listGambarStrukturMikro,
      aiModelCrack: requestBody.aiModelCrack,
      aiModelDegradasi: requestBody.aiModelDegradasi,
      aiModelFasa: requestBody.aiModelFasa,
      area: requestBody.area,
      etsa: requestBody.etsa,
      gritSandWhell: requestBody.gritSandWhell,
      kamera: requestBody.kamera,
      lokasi: requestBody.lokasi,
      material: requestBody.material,
      merkMikroskop: requestBody.merkMikroskop,
      perbesaranMikroskop: requestBody.perbesaranMikroskop,
      posisi: requestBody.posisi,
      tanggal: requestBody.tanggal,
      gambarKomponent1: requestBody.gambarKomponent1,
      gambarKomponent2: requestBody.gambarKomponent2,
      project: {
        namaProject: existingProject.namaProject,
        pemintaJasa: existingProject.pemintaJasa,
        tanggalOrderMasuk: existingProject.tanggalOrderMasuk,
        penguji: existingProject.penguji.map((penguji) => penguji.name),
      },
    }

    // 2. hit API External dengan membawa data Pengujian Project,
    const resultFromExternalApi = await analyzeProjectEvaluationWithAIExternalAPI(requestBodyForApiExternal, user);


    // simpan image dan hasil analisa ke database collection Sample, digunakan untuk menampilkan REKOMENDASI hasil analisa saat di menu Pengaturan Model AI
    const savedSample = await Sample.insertMany(resultFromExternalApi.hasilAnalisa);

    // 3. masukkan hasil dari "resultFromExternalApi" ke variabel "analyzedResultFromExternalAPI" 
    // dibawah ini disimulasikan dengan data dummy, anda seharusnya mengambil data tersebut dari API External
    // pastikan struktur data sesuai dengan yang diharapkan (sesuai dengan struktur data dummy dibawah ini)
    const analyzedResultToBeSaved = {
      projectEvaluationId: requestBody.projectEvaluationId,
      projectId: requestBody.projectId,
      nama: requestBody.nama,
      status: "COMPLETED",
      progress: 100,
      detail: {
        pemintaJasa: existingProject.pemintaJasa,
        tanggalOrderMasuk: existingProject.tanggalOrderMasuk,
        lokasi: requestBody.lokasi,
        area: requestBody.area,
        posisi: requestBody.posisi,
        material: requestBody.material,
        gritSandWhell: requestBody.gritSandWhell,
        etsa: requestBody.etsa,
        kamera: requestBody.kamera,
        merkMikroskop: requestBody.merkMikroskop,
        perbesaranMikroskop: requestBody.perbesaranMikroskop,
        gambarKomponent1: requestBody.gambarKomponent1,
        gambarKomponent2: requestBody.gambarKomponent2
      },
      hasilAnalisa: resultFromExternalApi.hasilAnalisa,
      kesimpulan: {
        strukturMikro: resultFromExternalApi.kesimpulan.strukturMikro,
        fiturMikroskopik: resultFromExternalApi.kesimpulan.fiturMikroskopik,
        damageClass: resultFromExternalApi.kesimpulan.damageClass,
        hardness: resultFromExternalApi.kesimpulan.hardness,
        rekomendasi: resultFromExternalApi.kesimpulan.rekomendasi
      },
      penguji: existingProject.penguji.map((penguji) => penguji.name),
      pemeriksa: [user.name]
    }

    // 4 simpan di database jika diperlukan (kemungkinan diperlukan agar di database kita juga menyimpan data hasil Analisa AI Model)
    await AnalyzedResult.create(analyzedResultToBeSaved);

    // 3. ubah status pengujian menjadi selesai dianalisa
    existingProjectEvaluation.isAnalyzed = true;

    await existingProjectEvaluation.save();

    res.status(200).json({
      status: true,
      message: "Pengujian Project berhasil berhasil dianalisa",
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getAnalyzedResult = async (req, res) => {
  try {
    const { id } = req.params;

    const analyzedResult = await AnalyzedResult.findOne({ projectEvaluationId: id }).lean();

    if (!analyzedResult) {
      return res.status(404).json({
        message: "Analyzed Result not found",
      });
    }

    res.status(200).json({
      status: true,
      message: "Berhasil mendapatkan Analyzed Result",
      data: analyzedResult,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
};

const updateAnalyzedResult = async (req, res) => {
  try {
    const user = req.existingUser;
    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const {
      type, // fasa | crack | degradasi
      mode, // AI | MANUAL
      hasilKlasifikasiManual,
      modelAnalyzedResultId, // hasilAnalisa[index]._id
    } = req.body;

    const analyzedResult = await AnalyzedResult.findOne({ projectEvaluationId: id });
    if (!analyzedResult) {
      return res.status(404).json({ message: "Analyzed Result not found" });
    }

    // 🔍 Cari index berdasarkan _id hasilAnalisa
    const index = analyzedResult.hasilAnalisa.findIndex(
      (item) => item._id.toString() === modelAnalyzedResultId
    );

    if (index === -1) {
      return res.status(404).json({ message: "Data hasilAnalisa tidak ditemukan" });
    }

    // 📝 Update data berdasarkan type dan mode
    if (type && mode) {
      const target = analyzedResult.hasilAnalisa[index][type];

      if (!target) {
        return res.status(400).json({ message: `Tipe '${type}' tidak valid` });
      }

      // Update hanya jika mode MANUAL
      target.mode = mode;
      target.hasilKlasifikasiManual = hasilKlasifikasiManual;
    }

    await analyzedResult.save();

    res.status(200).json({
      status: true,
      message: "Hasil analisa berhasil diperbarui",
      data: analyzedResult
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getAiRecommendationFromSampleBackup = async (req, res) => {
  try {
    const user = req.existingUser;
    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }


    const { type, imageList } = req.body;

    if (!["fasa", "crack", "degradasi"].includes(type)) {
      return res.status(400).json({ message: "Invalid type provided." });
    }

    // Ambil semua sample
    const samples = await Sample.find({});

    // Cocokkan sample berdasarkan imageList
    const matchedSamples = samples.filter((sample) => {
      return imageList.some((imagePath) => sample.image.endsWith(imagePath));
    });

    // Ambil hasil AI recommendation berdasarkan type yang dipilih
    const aiRecommendationResult = matchedSamples.map((sample, index) => {
      const data = sample[type];

      return {
        image: sample.image,
        penguji: data?.penguji ?? `Penguji ${index + 1}`,
        tanggalUpdate: data?.tanggalUpdate ?? null,
        mode: data?.mode ?? null,
        hasilKlasifikasiAI: data?.hasilKlasifikasiAI ?? null,
        modelAI: data?.modelAI ?? null,
        confidence: data?.confidence ?? null,
        hasilKlasifikasiManual: data?.hasilKlasifikasiManual ?? null,
        isAnotated: true,
      };
    });

    res.status(200).json({
      status: true,
      message: "Recommendation data fetched successfully",
      data: {
        type,
        aiRecommendationResult,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getAiRecommendationFromSample = async (req, res) => {
  try {
    const user = req.existingUser;
    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { type, imageList } = req.body;

    if (!["fasa", "crack", "degradasi"].includes(type)) {
      return res.status(400).json({ message: "Invalid type provided." });
    }

    // Query semua sample yang filenya ada di imageList
    const samples = await Sample.find({
      image: { $in: imageList.map(name => new RegExp(name + "$")) }
    })
      .sort({ createdAt: -1 }) // urutkan dari terbaru
      .lean();

    // Ambil hanya 1 (terbaru) untuk setiap nama file
    const latestPerImage = {};
    for (const sample of samples) {
      const fileName = path.basename(sample.image);
      if (!latestPerImage[fileName]) {
        latestPerImage[fileName] = sample;
      }
    }

    // Susun hasil sesuai urutan imageList dari request
    const aiRecommendationResult = imageList
      .map(name => latestPerImage[name])
      .filter(Boolean) // hapus yang tidak ketemu
      .map((sample, index) => {
        const data = sample[type];
        return {
          image: sample.image,
          penguji: data?.penguji ?? `Penguji ${index + 1}`,
          tanggalUpdate: data?.tanggalUpdate ?? null,
          mode: data?.mode ?? null,
          hasilKlasifikasiAI: data?.hasilKlasifikasiAI ?? null,
          modelAI: data?.modelAI ?? null,
          confidence: data?.confidence ?? null,
          hasilKlasifikasiManual: data?.hasilKlasifikasiManual ?? null,
          isAnotated: true,
        };
      });

    res.status(200).json({
      status: true,
      message: "Recommendation data fetched successfully",
      data: {
        type,
        aiRecommendationResult,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const createReportProjectEvaluation = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    //  ====== TODO: Untuk handle Create Report Hasil Analisa  ====== 
    const requestBody = req.body

    // ==== Contoh isi requestBody dari FE ====
    console.log(requestBody);


    // ==== dengan data dari requestBody nanti bisa disesuaikan sesuai kebutuhan =====

    res.status(200).json({
      status: true,
      message: "Create Report Successfully",
      data: {
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
}

const startTraining = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    //  ====== TODO: Untuk handle training AI ======
    const requestBody = req.body

    console.log(requestBody);

    // ==== Contoh isi requestBody dari FE =====
    // {
    //   type: "fasa" | "crack" | "degradasi", 
    //   aiRecommendationResult: [
    //     {
    //       image: "http://localhost:1945/uploads/20250707_175445_gv2aj.png",
    //       penguji: "Samwell Tarley 5",
    //       tanggalUpdate: "2025-01-15T00:00:00.000Z",
    //       mode: "AI",
    //       hasilKlasifikasiAI: "Austenite", // Notes: Digunakan saat mode === "AI"
    //       modelAI: "Model AI FASA 12",
    //       confidence: 90.1,
    //       hasilKlasifikasiManual: null, // Notes: Digunakan saat mode === "MANUAL"
    //       isAnotated: true,
    //       useRecommendation: true
    //     },
    //     {
    //       image: "http://localhost:1945/uploads/20250707_175445_v04a0a.png",
    //       penguji: "Samwell Tarley 6",
    //       tanggalUpdate: "2025-01-15T00:00:00.000Z",
    //       mode: "AI",
    //       hasilKlasifikasiAI: "Austenite", // Notes: Digunakan saat mode === "AI"
    //       modelAI: "Model AI FASA 12", // Notes: Digunakan saat mode === "MANUAL"
    //       confidence: 90.1,
    //       hasilKlasifikasiManual: null,
    //       isAnotated: true,
    //       useRecommendation: true
    //     }
    //   ],
    //     useOlderDatasetImage: true,
    // }

    res.status(200).json({
      status: true,
      message: "Data Traning Successfully",
      data: {
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
}

const saveModel = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    //  ====== TODO: Untuk handle save model AI ====== 
    const requestBody = req.body
    const files = req.files;


    // ==== Contoh isi requestBody dari FE (untuk saat ini request dari FE sama dengan di controller startTraining karena dri kita tidak tahu apa yg diperlukan) =====

    // {
    //   type: "fasa" | "crack" | "degradasi", 
    //   aiRecommendationResult: [
    //     {
    //       image: "http://localhost:1945/uploads/20250707_175445_gv2aj.png",
    //       penguji: "Samwell Tarley 5",
    //       tanggalUpdate: "2025-01-15T00:00:00.000Z",
    //       mode: "AI",
    //       hasilKlasifikasiAI: "Austenite",
    //       modelAI: "Model AI FASA 12",
    //       confidence: 90.1,
    //       hasilKlasifikasiManual: null,
    //       isAnotated: true,
    //       useRecommendation: true
    //     },
    //     {
    //       image: "http://localhost:1945/uploads/20250707_175445_v04a0a.png",
    //       penguji: "Samwell Tarley 6",
    //       tanggalUpdate: "2025-01-15T00:00:00.000Z",
    //       mode: "AI",
    //       hasilKlasifikasiAI: "Austenite",
    //       modelAI: "Model AI FASA 12",
    //       confidence: 90.1,
    //       hasilKlasifikasiManual: null,
    //       isAnotated: true,
    //       useRecommendation: true
    //     }
    //   ],
    //     useOlderDatasetImage: true,
    //     aiFileModelName: "model_fasa_12"
    // }

    // ==== dengan data dari requestBody nanti bisa disesuaikan sesuai kebutuhan =====

    res.status(200).json({
      status: true,
      message: "Save Model Successfully",
      data: {
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
}

const saveCompletedModel = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    //  ====== TODO: Untuk handle save model AI yang sudah jadi ====== 
    const requestBody = req.body

    // ==== Contoh isi requestBody dari FE ====
    // {
    //   aiModelName: "Model AI Fasa 12",
    // }

    const files = req.files

    // ==== Contoh isi requestBody dari FE ====
    // {
    //   aiModelFile: file ai //
    // }


    // ==== dengan data dari requestBody nanti bisa disesuaikan sesuai kebutuhan =====

    res.status(200).json({
      status: true,
      message: "Save Model Successfully",
      data: {
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// const getUploadedSample = async (req, res) => {
//   const uploadFolder = process.env.UPLOAD_FOLDER || 'uploads';
//   const baseUrl = `${process.env.APP_URL}/${uploadFolder}`;
//   const requestedPath = req.query.path || '';
//   const folderPath = path.resolve(process.cwd(), uploadFolder, requestedPath);

//   console.log({ folderPath });

//   try {
//     // Step 1: Ambil semua path image dari Sample
//     const samples = await Sample.find({}, {
//       "fasa.image": 1,
//       "crack.image": 1,
//       "degradasi.image": 1
//     }).lean();

//     // Step 2: Ambil pathname dari setiap image URL
//     const imagePathsSet = new Set();

//     samples.forEach(sample => {
//       [sample.fasa?.image, sample.crack?.image, sample.degradasi?.image].forEach(url => {
//         if (url) {
//           try {
//             const parsed = new URL(url);
//             // Ambil hanya pathname yang mirip `/uploads/path/to/file.jpg`
//             const pathname = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
//             imagePathsSet.add(pathname); // simpan dalam Set
//           } catch (err) {
//             // jika bukan URL valid, skip
//           }
//         }
//       });
//     });

//     // Step 3: Baca folder lalu filter hanya file yang ada di Sample DB
//     const items = fs.readdirSync(folderPath).map((entry) => {
//       const entryFullPath = path.join(folderPath, entry);
//       const stats = fs.statSync(entryFullPath);
//       const relativePath = path.join(requestedPath, entry).replace(/\\/g, '/');
//       const fullPathForComparison = `${uploadFolder}/${relativePath}`.replace(/\\/g, '/');

//       return {
//         name: entry,
//         path: relativePath,
//         type: stats.isDirectory() ? 'folder' : 'file',
//         url: !stats.isDirectory() ? `${baseUrl}/${relativePath}` : undefined,
//         size: stats.isDirectory() ? undefined : stats.size,
//         extension: path.extname(entry),
//         createdAt: stats.birthtime,
//         modifiedAt: stats.mtime,
//         isUsedInSample: imagePathsSet.has(fullPathForComparison)
//       };
//     });

//     // Step 4: Filter hanya file yang digunakan di Sample
//     const filteredItems = items.filter(item => item.type === 'folder' || item.isUsedInSample);

//     res.json(filteredItems);
//   } catch (err) {
//     res.status(500).json({ error: 'Gagal membaca folder', detail: err.message });
//   }
// }

const getUploadedSample = async (req, res) => {
  const uploadFolder = process.env.UPLOAD_FOLDER || 'uploads';
  const baseUrl = `${process.env.APP_URL}/${uploadFolder}`;
  const requestedPath = req.query.path || '';
  const folderPath = path.resolve(process.cwd(), uploadFolder, requestedPath);

  try {
    // Step 1: Ambil semua path image dari Sample
    const samples = await Sample.find({}, {
      "image": 1,
    }).lean();

    // Step 2: Ambil pathname dari setiap image URL
    const imagePathsSet = new Set();

    samples.forEach(sample => {
      if (sample.image) {
        try {
          const imageName = path.basename(sample.image);
          const pathname = `${uploadFolder}/${imageName}`.replace(/\\/g, '/')
          imagePathsSet.add(pathname); // simpan dalam Set
        } catch (err) {
          // jika bukan URL valid, skip
        }
      }
    });

    // Step 3: Baca folder lalu filter hanya file yang ada di Sample DB
    const items = fs.readdirSync(folderPath).map((entry) => {
      const entryFullPath = path.join(folderPath, entry);
      const stats = fs.statSync(entryFullPath);
      const relativePath = path.join(requestedPath, entry).replace(/\\/g, '/');
      const fullPathForComparison = `${uploadFolder}/${relativePath}`.replace(/\\/g, '/');

      return {
        name: entry,
        path: relativePath,
        type: stats.isDirectory() ? 'folder' : 'file',
        // url: !stats.isDirectory() ? `${baseUrl}/${relativePath}` : undefined,
        url: !stats.isDirectory() ? getAssetURL(relativePath) : undefined,
        size: stats.isDirectory() ? undefined : stats.size,
        extension: path.extname(entry),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        isUsedInSample: imagePathsSet.has(fullPathForComparison)
      };
    });

    // Step 4: Filter hanya file yang digunakan di Sample
    const filteredItems = items.filter(item => item.type === 'folder' || item.isUsedInSample);

    res.json(filteredItems);
  } catch (err) {
    res.status(500).json({ error: 'Gagal membaca folder', detail: err.message });
  }
}


module.exports = {
  getImageProfile,
  registerUser,
  loginUser,
  logoutUser,
  getUsers,
  getUserById,
  getPenguji,
  editUser,
  deleteUser,
  getAllProject,
  getProjectByIdProject,
  getAiModelList,
  analyzeProjectEvaluation,
  getAnalyzedResult,
  updateAnalyzedResult,
  getAiClasificationList,
  getAiRecommendationFromSample,
  addProject,
  verifyUser,
  editProject,
  deleteProject,
  addUserProject,
  getUserProject,
  getServiceRequester,
  addServiceRequester,
  deleteServiceRequester,
  addProjectEvaluation,
  editProjectEvaluation,
  getProjectEvaluationById,
  deleteProjectEvaluationById,
  deleteProjectEvaluationImageComponent1,
  deleteProjectEvaluationImageComponent2,
  deleteProjectEvaluationImageListMicroStructure,
  updateProjectEvaluationStatusToPending,
  updateProjectEvaluationStatusToProcessing,
  startTraining,
  saveModel,
  createReportProjectEvaluation,
  saveCompletedModel,
  getUploadedSample,
};
