const sanitize = require("mongo-sanitize");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const User = require("../models/User");
const Session = require("../models/Session");
const Project = require("../models/Project");

// Helpers
const hashPassword = async (password) => await bcrypt.hash(password, 10);
const verifyPassword = async (input, hash) => await bcrypt.compare(input, hash);

const isUnauthorized = (user) => {
  !user || !user.isVerify;
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
      isVerify: true,
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
      return res.status(400).json({ message: "Login failed" });
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
    const admin = req.existingUser;

    if (isUnauthorized(admin)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const users = await User.find({ isSuperAdmin: false }).select(
      "name nomorInduk devisi jabatan email noHp alamat filename _id"
    );

    res.status(200).json({ message: users });
  } catch (err) {
    res.status(500).json({ message: "Get users failed" });
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

// Controller: Auth check role
const checkAuth = (req, res) => {
  const user = req.existingUser;
  const role = user.isAdmin || user.isSuperAdmin ? "supervisor" : "user";
  res.status(200).json({ role, message: "Valid token" });
};

// Controller: Get all projects (admin only)
const getAllProject = async (req, res) => {
  try {
    const user = req.existingUser;

    if (isUnauthorized(user)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const projects = await Project.find().select(
      "namaProject permintaanJasa sample tglPengujian lokasiPengujian areaPengujian posisiPengujian material GritSandWhell ETSA kamera mikrosopMerk mikrosopZoom _id"
    );

    res.status(200).json({ message: projects });
  } catch (err) {
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

    const existingProject = await Project.findOne({ namaProject });
    if (existingProject) {
      return res
        .status(200)
        .json({ status: false, message: "Nama project sudah terdaftar" });
    }

    const newProject = new Project({
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
      userArrayId: [],
    });

    await newProject.save();
    res
      .status(200)
      .json({ status: true, message: "Project berhasil ditambahkan" });
  } catch (err) {
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

const getProfile = async (req, res) => {
  try {
    //! data dati authoMidddleware
    const existingUser = req.existingUser;

    //! jika tidak ditemukan user atau blm di verify
    if (!existingUser || !existingUser.isVerify || existingUser.isSuperAdmin) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    //! cek apakah semua user terdaftar
    const foundUser = await User.findById(existingUser._id).select(
      "name nomorInduk devisi jabatan -_id"
    );

    if (foundUser) {
      return res.status(200).json({ message: foundUser });
    }

    return res.status(400).json({ message: "Data tidak ditemukan" });
  } catch (error) {
    res.status(500).json({ message: "Get Data user failed" });
  }
};

module.exports = {
  getImageProfile,
  registerUser,
  loginUser,
  logoutUser,
  getUsers,
  editUser,
  deleteUser,
  checkAuth,
  getAllProject,
  addProject,
  editProject,
  deleteProject,
  addUserProject,
  getUserProject,
  getProfile,
};
