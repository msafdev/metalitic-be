const sanitize = require("mongo-sanitize");
const User = require("../models/User");
const Session = require("../models/Session");
const jwt = require("jsonwebtoken");

const bcrypt = require("bcrypt");

async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

async function verifyPassword(inputPassword, storedHashedPassword) {
  return await bcrypt.compare(inputPassword, storedHashedPassword);
}

const registerSuperAdmin = async (req, res) => {
  try {
    //! blm ada filter dari body nya
    const { username, password, name, code, role } = req.body;
    //! hash password
    const hashedPassword = await hashPassword(password);

    if (role !== "superadmin" && code !== "@#$%L") {
      return res.status(404).json({ message: "signup error #2" });
    }

    //! jika username sudah exist
    const existingUser = await User.findOne({ username: username });

    if (existingUser) {
      return res.status(404).json({ message: "signup error" });
    }

    // Simpan user ke database
    const newUser = new User({
      username: username,
      password: hashedPassword,
      name: name,
      nomorInduk: "-",
      devisi: "-",
      jabatan: "-",
      email: "-",
      noHp: "-",
      alamat: "-",
      projects: null,
      filename: "-",
      filepath: "-",
      isSuperAdmin: true,
      isAdmin: false,
      isVerify: false,
    });
    await newUser.save();

    res.status(200).json({
      message: "Registrasi berhasil, silahkan tunggu proses verifikasi",
    });
  } catch (error) {
    res.status(500).json({ message: error });
  }
};

const loginAdmin = async (req, res) => {
  try {
    const username = sanitize(req.body.username);
    const inputPassword = req.body.password;

    const existingUser = await User.findOne({ username });
    if (!existingUser || !existingUser.isVerify || !existingUser.isSuperAdmin) {
      return res.status(400).json({ message: "Login failed" });
    }

    const isVerifyPassword = await verifyPassword(
      inputPassword,
      existingUser.password
    );

    if (!isVerifyPassword) {
      return res.status(400).json({ message: "Login failed" });
    }

    const token = jwt.sign({ username }, process.env.JWT_SECRET_ADMIN, {
      expiresIn: "1h",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      maxAge: 3600000,
    });

    res.cookie("role", "superadmin", {
      httpOnly: false,
      secure: true,
      sameSite: "Strict",
      maxAge: 3600000,
    });

    await Session.deleteMany({ userId: existingUser._id });
    await new Session({ userId: existingUser._id, token }).save();

    return res.status(200).json({ message: "Login Super Admin berhasil" });
  } catch (error) {
    return res.status(500).json({ message: "Login failed" });
  }
};

const registerAdmin = async (req, res) => {
  try {
    //! data dati authoMidddleware
    const existingUser = req.existingUser;
    //! blm ada filter dari body nya
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

    // console.log("existingUser ", existingUser)
    //! jika tidak ditemukan user atau blm di verify
    if (!existingUser || !existingUser.isVerify || !existingUser.isSuperAdmin) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    //! cek akun
    const existingUserRegister = await User.findOne({
      $or: [
        { username: username },
        { nomorInduk: nomorInduk },
        { email: email },
        { noHp: noHp },
      ],
    });

    // console.log("existingUserRegister ", existingUserRegister)

    if (existingUserRegister) {
      return res.status(400).json({
        status: false,
        message:
          "Register failed, username, nomor induk , email atau noHp sudah terdaftar",
      });
    }

    //! hash password
    const hashedPassword = await hashPassword(password);

    //! Simpan user ke database
    const newUser = new User({
      username: username,
      password: hashedPassword,
      name: name,
      nomorInduk: nomorInduk,
      devisi: devisi,
      jabatan: jabatan,
      email: email,
      noHp: noHp,
      alamat: alamat,
      projects: [],
      filename: "-",
      filepath: "-",
      isSuperAdmin: false,
      isAdmin: true,
      isVerify: false,
    });
    await newUser.save();

    res.status(200).json({
      message: "Registrasi berhasil, silahkan tunggu proses verifikasi",
    });
  } catch (error) {
    res.status(500).json({ message: "register failed" });
  }
};

const verifyAdmin = async (req, res) => {
  try {
    const existingUser = req.existingUser;
    const usernameVerify = req.body.username;
    const isVerify = req.body.isVerify;

    if (!existingUser || !existingUser.isSuperAdmin) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (existingUser.isSuperAdmin) {
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

const deleteUser = async (req, res) => {
  try {
    const existingUser = req.existingUser;
    const { id } = req.body;

    //! jika tidak ditemukan user atau blm di verify
    if (!existingUser || !existingUser.isVerify || !existingUser.isSuperAdmin) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    //! cek akun
    const userFound = await User.findById(id);
    if (!userFound.isSuperAdmin) {
      const result = await User.findByIdAndDelete(id);

      if (!result) {
        return res.status(400).json({ message: "Delete user failed" });
      }

      return res.status(200).json({ message: "success" });
    }
    return res.status(400).json({ message: "Delete user failed" });
  } catch (error) {
    res.status(500).json({ message: "Unauthorized" });
  }
};

const listUserNeedVerify = async (req, res) => {
  try {
    const usernameToken = req.username;
    //! cek akun
    const existingUser = await User.findOne({ username: usernameToken });
    //! jika tidak ditemukan user atau blm di verify
    if (!existingUser || !existingUser.isVerify || !existingUser.isSuperAdmin) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    //! hanya admin yang diijinkan delete user
    if (existingUser.isAdmin) {
      const result = await User.find({ isVerify: false }).select(
        "username -_id"
      );

      return res.status(200).json({ message: result });
    }

    res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    res.status(500).json({ message: "Unauthorized" });
  }
};

const getUsers = async (req, res) => {
  try {
    const result = await User.find().select("*");
    res.status(200).json({ message: result });
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
};

module.exports = {
  registerSuperAdmin,
  loginAdmin,
  registerAdmin,
  verifyAdmin,
  deleteUser,
  listUserNeedVerify,
  getUsers,
};
