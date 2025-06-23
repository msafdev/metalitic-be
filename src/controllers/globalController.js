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
  !user || !user.isVerify;
};

// Controller: Auth check role
const checkAuth = (req, res) => {
  const user = req.existingUser;

  const role = user.isSuperAdmin
    ? "superadmin"
    : user.isAdmin
    ? "supervisor"
    : "user";
  res.status(200).json({ role, message: "Valid token" });
};

const getProfile = async (req, res) => {
  try {
    //! data dati authoMidddleware
    const existingUser = req.existingUser;

    //! jika tidak ditemukan user atau blm di verify
    if (!existingUser || !existingUser.isVerify) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    //! cek apakah semua user terdaftar
    const foundUser = await User.findById(existingUser._id)
      .select("name nomorInduk devisi jabatan isSuperAdmin isAdmin _id")
      .lean();

    if (foundUser) {
      return res.status(200).json({
        message: {
          ...foundUser,
          role: foundUser.isSuperAdmin
            ? "superadmin"
            : foundUser.isAdmin
            ? "supervisor"
            : "user",
        },
      });
    }

    return res.status(400).json({ message: "Data tidak ditemukan" });
  } catch (error) {
    res.status(500).json({ message: "Get Data user failed" });
  }
};

module.exports = {
  checkAuth,
  getProfile,
};
