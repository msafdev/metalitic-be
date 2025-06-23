const sanitize = require("mongo-sanitize");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const User = require("../models/User");
const Session = require("../models/Session");
const Project = require("../models/Project");
const ServiceRequester = require("../models/ServiceRequester");
const ProjectEvaluation = require("../models/ProjectEvaluation");

// Helpers
const hashPassword = async (password) => await bcrypt.hash(password, 10);
const verifyPassword = async (input, hash) => await bcrypt.compare(input, hash);

const isUnauthorized = (user) => {
  !user || !user.isVerify || !user.isAdmin;
};

// Controller: Register
const registerUser = async (req, res) => {
  try {
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
    } = req.body;

    // Check duplicates
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
      filename: "-",
      filepath: "-",
      isSuperAdmin: false,
      isAdmin: false,
      isVerify: false,
    });

    await newUser.save();
    res.status(200).json({ status: true, message: "Registrasi user berhasil" });
  } catch (err) {
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
    await Session.deleteOne({ userId: req.existingUser._id });
    res.status(200).json({ message: "Logout berhasil" });
  } catch (err) {
    res.status(500).json({ message: "Logout failed" });
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
      "username name nomorInduk devisi jabatan email noHp alamat isVerify filename _id"
    );

    res.status(200).json({
      message: "Get users success",
      data: users,
    });
  } catch (err) {
    res.status(500).json({ message: "Get users failed" });
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

    console.log(existingUser);
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
    const admin = req.existingUser;
    const { id, name, devisi, jabatan, email, noHp, alamat, password } =
      req.body;

    if (isUnauthorized(admin)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(id);
    if (!user || user.isSuperAdmin) {
      return res.status(401).json({ message: "Unauthorized user" });
    }

    const [emailOwner, phoneOwner] = await Promise.all([
      User.findOne({ email: { $regex: `^${email}$`, $options: "i" } }),
      User.findOne({ noHp }),
    ]);

    if (emailOwner && emailOwner.username !== user.username) {
      return res.json({ status: false, message: "Email sudah terdaftar" });
    }

    if (phoneOwner && phoneOwner.username !== user.username) {
      return res.json({ status: false, message: "No HP sudah terdaftar" });
    }

    const hashedPassword =
      password !== "********" ? await hashPassword(password) : undefined;
    const updatedFields = {
      name,
      devisi,
      jabatan,
      email,
      noHp,
      alamat,
      ...(hashedPassword && { password: hashedPassword }),
      ...(req.file && {
        filename: req.file.filename,
        filepath: req.file.path,
      }),
    };

    const updatedUser = await User.findByIdAndUpdate(id, updatedFields, {
      new: true,
    });

    if (req.file && user.filepath) {
      fs.unlink(path.resolve(user.filepath), (err) => {
        if (!err) console.log("Old file deleted");
      });
    }

    res.status(200).json({ status: true, message: "Edit berhasil" });
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

    const projects = await Project.find().select(
      "_id idProject namaProject pemintaJasa tanggalOrderMasuk createdAt updatedAt penguji"
    );

    res.status(200).json({
      data: projects,
      message: "Get all project success",
    });
  } catch (err) {
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
        .select(
          "_id idProject namaProject pemintaJasa tanggalOrderMasuk createdAt updatedAt penguji"
        )
        .lean(),
      ProjectEvaluation.find({ projectId: idProject }).lean(),
    ]);

    // Tambahkan progress untuk setiap evaluation
    const projectEvaluationsWithProgress = projectEvaluations.map(
      (evaluation) => {
        const { progress, missingFields } = calculateProgressWithMissingFields(
          evaluation,
          ProjectEvaluation.schema
        );

        return {
          id: evaluation.id,
          projectId: evaluation.projectId,
          nama: evaluation.nama,
          status: evaluation.status,
          progress,
          missingFields,
          createdAt: evaluation.createdAt,
          updatedAt: evaluation.updatedAt,
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
      return res
        .status(400)
        .json({ status: false, message: "Project sudah terdaftar" });
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
      penguji,
    });

    await newProject.save();

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

    const existingProject = await Project.findById(id);
    if (!existingProject) {
      return res.status(404).json({ message: "Project tidak ditemukan" });
    }

    const duplicateProject = await Project.findOne({ namaProject });
    if (
      duplicateProject &&
      duplicateProject.namaProject !== existingProject.namaProject
    ) {
      return res.status(200).json({
        status: false,
        message: "Edit gagal, nama project sudah digunakan",
      });
    }

    const updated = await Project.findByIdAndUpdate(
      id,
      {
        namaProject,
        permintaanJasa,
        sample,
        tglPengujian: convertDate(tglPengujian),
        lokasiPengujian,
        areaPengujian,
        posisiPengujian,
        material,
        GritSandWhell,
        ETSA,
        kamera,
        mikrosopMerk,
        mikrosopZoom,
      },
      { new: true }
    );

    res
      .status(200)
      .json({ status: true, message: "Edit berhasil", data: updated });
  } catch (err) {
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

    const { id } = req.body;
    const deleted = await Project.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(400).json({ message: "Delete project failed" });
    }

    res.status(200).json({ message: "Project berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ message: "Delete Project failed" });
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
      merkMikrosop,
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
      status: "PENDING",
      nama,
      tanggal,
      lokasi,
      area,
      posisi,
      material,
      gritSandWhell,
      etsa,
      kamera,
      merkMikrosop,
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
      merkMikrosop,
      perbesaranMikroskop,
      gambarKomponent1,
      gambarKomponent2,
      listGambarStrukturMikro,
      aiModelFasa,
      aiModelCrack,
      aiModelDegradasi,
    } = req.body;

    const existingProjectEvaluation = await ProjectEvaluation.findOne({ id });

    if (!existingProjectEvaluation) {
      return res.status(400).json({
        status: false,
        message: `Pengujian Project dengan id ${id} tidak ditemukan`,
      });
    }

    existingProjectEvaluation.projectId = projectId;
    existingProjectEvaluation.nama = nama;
    existingProjectEvaluation.tanggal = tanggal;
    existingProjectEvaluation.lokasi = lokasi;
    existingProjectEvaluation.area = area;
    existingProjectEvaluation.posisi = posisi;
    existingProjectEvaluation.material = material;
    existingProjectEvaluation.gritSandWhell = gritSandWhell;
    existingProjectEvaluation.etsa = etsa;
    existingProjectEvaluation.kamera = kamera;
    existingProjectEvaluation.merkMikrosop = merkMikrosop;
    existingProjectEvaluation.perbesaranMikroskop = perbesaranMikroskop;
    existingProjectEvaluation.gambarKomponent1 = gambarKomponent1;
    existingProjectEvaluation.gambarKomponent2 = gambarKomponent2;
    existingProjectEvaluation.listGambarStrukturMikro = listGambarStrukturMikro;
    existingProjectEvaluation.aiModelFasa = aiModelFasa;
    existingProjectEvaluation.aiModelCrack = aiModelCrack;
    existingProjectEvaluation.aiModelDegradasi = aiModelDegradasi;

    await existingProjectEvaluation.save();

    res.status(200).json({
      status: true,
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

    const existingProjectEvaluation = await ProjectEvaluation.findOne({ id });

    if (!existingProjectEvaluation) {
      return res.status(400).json({
        status: false,
        message: `Pengujian Project dengan id ${id} tidak ditemukan`,
      });
    }

    res.status(200).json({
      status: true,
      message: "Pengujian Project berhasil ditemukan",
      data: existingProjectEvaluation,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
};

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

module.exports = {
  getImageProfile,
  registerUser,
  loginUser,
  logoutUser,
  getUsers,
  getPenguji,
  editUser,
  deleteUser,
  getAllProject,
  getProjectByIdProject,
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
};
