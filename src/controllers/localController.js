const sanitize = require("mongo-sanitize");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
// const moment = require('moment');
const moment = require("moment-timezone");
const fs = require("fs");

const User = require("../models/User");
const UPT = require("../models/UPT");
const ULTG = require("../models/ULTG");
const NodeSetting = require("../models/Node_Seting");
const Node = require("../models/Node");
const Realtime = require("../models/Realtime");
const Unit = require("../models/Unit");

async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

async function verifyPassword(inputPassword, storedHashedPassword) {
  return await bcrypt.compare(inputPassword, storedHashedPassword);
}

const registerLocal = async (req, res) => {
  try {
    //! blm ada filter dari body nya
    const username = sanitize(req.body.username);
    //! hash password
    const hashedPassword = await hashPassword(req.body.password);
    let role = req.body.role; //!admin, local, UPT, ULTG, unit
    let UPTparam = req.body.UPT; //!data UPT
    let ULTGparam = req.body.ULTG; //!data ULTG
    let unitParam = req.body.unit; //!data unit
    //! jika username sudah exist
    const existingUser = await User.findOne({ username: username });
    if (existingUser) {
      return res.status(404).json({ message: "signup error" });
    }
    //! cek role
    const roleValidation = ["admin", "local", "UPT", "ULTG", "unit"];
    if (!roleValidation.includes(role)) {
      return res.status(404).json({ message: "signup error" });
    }

    if (role === "UPT") {
      const existingUPT = await UPT.findOne({ UPT: UPTparam });
      if (!existingUPT) {
        return res
          .status(404)
          .json({ message: "signup error UPT tidak sesuai" });
      }
      ULTGparam = "none";
      unitParam = "none";
    } else if (role === "ULTG") {
      const existingUPT = await UPT.findOne({ UPT: UPTparam });
      if (!existingUPT) {
        return res
          .status(404)
          .json({ message: "signup error UPT tidak sesuai" });
      }
      const existingULTG = await ULTG.findOne({
        UPTId: existingUPT._id,
        ULTG: ULTGparam,
      });
      if (!existingULTG) {
        return res
          .status(404)
          .json({ message: "signup error ULTG tidak sesuai" });
      }
      unitParam = "none";
    } else if (role === "unit") {
      const existingUPT = await UPT.findOne({ UPT: UPTparam });
      if (!existingUPT) {
        return res
          .status(404)
          .json({ message: "signup error UPT tidak sesuai" });
      }
      const existingULTG = await ULTG.findOne({
        UPTId: existingUPT._id,
        ULTG: ULTGparam,
      });
      if (!existingULTG) {
        return res
          .status(404)
          .json({ message: "signup error ULTG tidak sesuai" });
      }
      const existingUnit = await Unit.findOne({
        ULTGId: existingULTG._id,
        unit: unitParam,
      });
      if (!existingUnit) {
        return res
          .status(404)
          .json({ message: "signup error Unit tidak sesuai" });
      }
    } else {
      UPTparam = "none";
      ULTGparam = "none";
      unitParam = "none";
    }

    // Simpan user ke database
    const newUser = new User({
      username: username,
      password: hashedPassword,
      name: username,
      noHp: "none",
      role: role, //! local, UPT, ULTG, unit
      UPT: UPTparam, //! none = bukan UPT
      ULTG: ULTGparam, //! none = bukan ULTG
      unit: unitParam, //! none = bukan unit
      nodes: [],
      filename: "none",
      filepath: "none",
      isAdmin: false,
      isVerify: false,
    });
    await newUser.save();

    res
      .status(200)
      .json({
        message: "Registrasi berhasil, silahkan tunggu proses verifikasi",
      });
  } catch (error) {
    res.status(500).json({ message: "signup error" });
  }
};

const loginLocal = async (req, res) => {
  try {
    const username = sanitize(req.body.username);
    const inputPassword = req.body.password;

    //! jika username sudah exist
    const existingUser = await User.findOne({ username: username });
    //! cek apakah sudah di verify
    if (!existingUser || !existingUser.isVerify) {
      return res.status(400).json({ message: "login failed" });
    }

    const isVerifyPassword = await verifyPassword(
      inputPassword,
      existingUser.password
    );
    // console.log("result ", isVerifyPassword)
    if (!isVerifyPassword) {
      return res.status(400).json({ message: "login failed" });
    }

    // Buat JWT Token
    const token = jwt.sign(
      { username: username, role: existingUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Simpan JWT dalam HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true, // Mencegah akses JavaScript (XSS)
      secure: true, // Hanya aktif jika pakai HTTPS
      sameSite: "Strict", // Mencegah CSRF
      maxAge: 3600000, // Cookie berlaku 1 jam
    });

    res.cookie("role", existingUser.role, {
      httpOnly: false, // Bisa diakses oleh JavaScript
      secure: true, // Hanya aktif jika pakai HTTPS
      sameSite: "Strict", // Mencegah CSRF
      maxAge: 3600000, // Cookie berlaku 1 jam
    });

    res.status(200).json({ message: "Login berhasil" });
  } catch (error) {
    res.status(500).json({ message: "login failed" });
  }
};

const addUPT = async (req, res) => {
  try {
    const usernameToken = req.username;
    const UPTparam = req.body.UPT;
    //! cek akun
    const existingUser = await User.findOne({ username: usernameToken });
    //! jika tidak ditemukan user atau blm di verify
    if (!existingUser || !existingUser.isVerify) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    //! hanya admin dan role local yang diijinkan save data
    if (existingUser.isAdmin || existingUser.role === "local") {
      const existingUPT = await UPT.findOne({ UPT: UPTparam });
      if (existingUPT) {
        return res.status(404).json({ message: "UPT sudah terdaftar" });
      }
      //! Simpan UPT ke database
      const newUUPT = new UPT({
        UPT: UPTparam,
      });
      await newUUPT.save();

      return res.status(200).json({ message: "UPT berhasil disimpan" });
    }

    res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    res.status(500).json({ message: "Unauthorized" });
  }
};

const addULTG = async (req, res) => {
  try {
    const usernameToken = req.username;
    const UPTparam = req.body.UPT;
    const ULTGparam = req.body.ULTG;
    //! cek akun
    const existingUser = await User.findOne({ username: usernameToken });
    //! jika tidak ditemukan user atau blm di verify
    if (!existingUser || !existingUser.isVerify) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    //! hanya admin dan role local yang diijinkan save data
    if (existingUser.isAdmin || existingUser.role === "local") {
      //! cek UPT
      const existingUPT = await UPT.findOne({ UPT: UPTparam });
      if (!existingUPT) {
        return res.status(404).json({ message: "UPT belum terdaftar" });
      }

      //! cek ULTG
      const existingULTG = await ULTG.findOne({
        UPTId: existingUPT._id,
        ULTG: ULTGparam,
      });
      if (existingULTG) {
        return res.status(404).json({ message: "ULTG sudah terdaftar" });
      }
      // //! Simpan ULTG ke database
      const newULTG = new ULTG({
        UPTId: existingUPT._id, // Referensi ke UPT
        ULTG: ULTGparam,
      });

      await newULTG.save();

      return res.status(200).json({ message: "ULTG berhasil disimpan" });
    }

    res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    res.status(500).json({ message: "Unauthorized" });
  }
};

const deleteULTG = async (req, res) => {
  try {
    const usernameToken = req.username;
    const ULTGparam = req.body.ULTG;
    //! cek akun
    const existingUser = await User.findOne({ username: usernameToken });
    //! jika tidak ditemukan user atau blm di verify
    if (!existingUser || !existingUser.isVerify) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    //! hanya admin dan role local yang diijinkan save data
    if (existingUser.isAdmin || existingUser.role === "local") {
      const result = await ULTG.deleteOne({ ULTG: ULTGparam });

      if (result.deletedCount === 0) {
        return res.status(400).json({ message: "ULTG tidak ditemukan" });
      }

      return res.status(200).json({ message: "ULTG berhasil dihapus" });
    }

    res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    res.status(500).json({ message: "Unauthorized" });
  }
};

const getUPT = async (req, res) => {
  try {
    const usernameToken = req.username;
    //! cek akun
    const existingUser = await User.findOne({ username: usernameToken });
    //! jika tidak ditemukan user atau blm di verify
    if (!existingUser || !existingUser.isVerify) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    //! hanya admin dan role local yang diijinkan save data
    if (existingUser.isAdmin || existingUser.role === "local") {
      const result = await UPT.find().select("UPT -_id");

      return res.status(200).json({ message: result });
    }

    res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    res.status(500).json({ message: "Unauthorized" });
  }
};

const getULTG = async (req, res) => {
  try {
    const usernameToken = req.username;
    //! cek akun
    const existingUser = await User.findOne({ username: usernameToken });
    //! jika tidak ditemukan user atau blm di verify
    if (!existingUser || !existingUser.isVerify) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    //! hanya admin dan role local yang diijinkan save data
    if (existingUser.isAdmin || existingUser.role === "local") {
      const result = await ULTG.aggregate([
        {
          $lookup: {
            from: "upts", // Nama koleksi UPT di MongoDB (harus kecil semua)
            localField: "UPTId",
            foreignField: "_id",
            as: "UPTData",
          },
        },
        { $unwind: "$UPTData" }, // Buka array hasil lookup
        {
          $group: {
            _id: "$UPTData.UPT",
            ULTGS: { $push: { ULTG: "$ULTG" } }, // Kelompokkan semua ULTG yang sesuai dengan UPT
          },
        },
        {
          $project: {
            _id: 0, // Hilangkan _id
            UPT: "$_id",
            ULTGS: 1,
          },
        },
      ]);

      return res.status(200).json({ message: result });
    }

    res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    res.status(500).json({ message: "Unauthorized" });
  }
};

const addNode = async (req, res) => {
  try {
    const usernameToken = req.username;
    const {
      nodeName,
      brand,
      type,
      gps_lat,
      gps_long,
      zonaInstallation,
      isolasi,
      minScale,
      maxScale,
      minValue,
      maxValue,
    } = req.body;
    const UPTparam = req.body.UPT;
    const ULTGparam = req.body.ULTG;
    const unitParam = req.body.unit;
    //! cek akun
    const existingUser = await User.findOne({ username: usernameToken });
    //! jika tidak ditemukan user atau blm di verify
    if (!existingUser || !existingUser.isVerify) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    //! hanya admin dan role local yang diijinkan save data
    if (existingUser.isAdmin || existingUser.role === "local") {
      //! cek node apakah exist
      const existingNode = await NodeSetting.findOne({ nodeName: nodeName });
      if (existingNode) {
        return res.status(400).json({ message: "nama Node sudah terdaftar" });
      }
      //! cek UTP apakah exist
      const existingUPT = await UPT.findOne({ UPT: UPTparam });
      if (!existingUPT) {
        return res.status(404).json({ message: "UPT tidak terdaftar" });
      }
      //! cek ULTG
      const existingULTG = await ULTG.findOne({
        UPTId: existingUPT._id,
        ULTG: ULTGparam,
      });
      if (!existingULTG) {
        return res.status(404).json({ message: "ULTG tidak terdaftar" });
      }
      //! cek Unit
      const existingUnit = await Unit.findOne({
        ULTGId: existingULTG._id,
        unit: unitParam,
      });
      if (!existingUnit) {
        return res.status(404).json({ message: "Unit tidak terdaftar" });
      }
      // Simpan nodeSetting ke database
      const newNodeSetting = new NodeSetting({
        nodeName: nodeName,
        UPT: UPTparam,
        ULTG: ULTGparam,
        unit: unitParam,
        brand: brand,
        type: type,
        gps_lat: gps_lat,
        gps_long: gps_long,
        zonaInstallation: zonaInstallation,
        isolasi: isolasi,
        minScale: minScale,
        maxScale: maxScale,
        minValue: minValue,
        maxValue: maxValue,
        filename: "none",
        filepath: "none",
      });
      await newNodeSetting.save();

      return res.status(200).json({ message: "Registrasi Node berhasil" });
    }

    res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    res.status(500).json({ message: "Unauthorized" });
  }
};

const updateNode = async (req, res) => {
  try {
    const usernameToken = req.username;
    const {
      id,
      nodeName,
      brand,
      type,
      gps_lat,
      gps_long,
      zonaInstallation,
      isolasi,
      minScale,
      maxScale,
      minValue,
      maxValue,
    } = req.body;
    const UPTparam = req.body.UPT;
    const ULTGparam = req.body.ULTG;
    const unitParam = req.body.unit;

    //! cek akun
    const existingUser = await User.findOne({ username: usernameToken });
    console.log("existingUser ", existingUser);
    //! jika tidak ditemukan user atau blm di verify
    if (!existingUser || !existingUser.isVerify) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    //! hanya admin dan role local yang diijinkan save data
    if (existingUser.isAdmin || existingUser.role === "local") {
      //! update
      const updatedNode = await NodeSetting.findOneAndUpdate(
        { _id: id }, // filter pencarian
        {
          nodeName: nodeName,
          brand: brand,
          type: type,
          gps_lat: gps_lat,
          gps_long: gps_long,
          zonaInstallation: zonaInstallation,
          isolasi: isolasi,
          minScale: minScale,
          maxScale: maxScale,
          minValue: minValue,
          maxValue: maxValue,
        }, // data yang akan di-update
        { new: true } // agar return-nya adalah data yang sudah di-update
      );

      // console.log("updatedNode ", updatedNode)

      if (!updatedNode) {
        return res.status(400).json({ message: "Update Node failed" });
      }

      return res.status(200).json({ message: "Update Node successful" });
    }

    res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    res.status(500).json({ message: "Unauthorized" });
  }
};

const getNodebyUPT = async (req, res) => {
  try {
    const usernameToken = req.username;
    const UPTparam = req.body.UPT;
    //! cek akun
    const existingUser = await User.findOne({ username: usernameToken });
    //! jika tidak ditemukan user atau blm di verify
    if (!existingUser || !existingUser.isVerify) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    //! hanya admin dan role local yang diijinkan save data
    if (existingUser.isAdmin || existingUser.role === "local") {
      //! cek UPT
      const existingUPT = await UPT.findOne({ UPT: UPTparam });
      if (!existingUPT) {
        return res.status(404).json({ message: "UPT belum terdaftar" });
      }

      const result = await NodeSetting.find({ UPT: UPTparam }).select(
        "nodeName UPT ULTG unit brand type gps_lat gps_long zonaInstallation isolasi minScale maxScale minValue maxValue _id"
      );

      return res.status(200).json({ message: result });
    }

    res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    res.status(500).json({ message: "Unauthorized" });
  }
};

const addNodeSensor = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }
    const usernameToken = req.username;
    const { nodeId, nodeName } = req.body;
    const jsonData = JSON.parse(req.body.data);
    const filepath = req.file.path;
    const filename = req.file.filename;
    //! cek akun
    const existingUser = await User.findOne({ username: usernameToken });
    //! jika tidak ditemukan user atau blm di verify
    if (!existingUser || !existingUser.isVerify) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    //! hanya admin dan role local yang diijinkan save data
    if (existingUser.isAdmin || existingUser.role === "local") {
      //! iterasi parameter data
      //! cek Node Setting
      const existingNodeSetting = await NodeSetting.findOne({ _id: nodeId });
      if (!existingNodeSetting) {
        return res.status(400).json({ message: "Save Node failed 001" });
      }
      //! update filepath dan filename di collection NodeSettings
      const updateNodeSetting = await NodeSetting.updateOne(
        { _id: nodeId }, // filter berdasarkan _id
        {
          $set: {
            filename: filename,
            filepath: filepath,
          },
        } // data yang diupdate
      );
      //! simpan data ke collection node
      //! Gunakan for...of agar bisa await di dalam loop
      for (const item of jsonData) {
        try {
          // Konversi ke waktu Asia/Jakarta lalu ke Date
          const jakartaDate = moment
            .tz(item.dateTime, "YYYY-MM-DD HH:mm:ss", "Asia/Jakarta")
            .toDate();

          const newNode = new Node({
            nodeId: existingNodeSetting._id,
            statusGauge: item.statusGauge,
            statusCam: item.statusCam,
            pressure: item.pressure,
            dateTime: item.dateTime,
            createdAt: jakartaDate,
          });
          await newNode.save();
        } catch (err) {
          return res.status(400).json({ message: "Save Node failed 002" });
        }
      }

      // //! data terkahir disimpan juga pada collection realtime
      const lastData = jsonData.at(-1);
      // Konversi ke waktu Asia/Jakarta lalu ke Date
      const jakartaDate = moment
        .tz(lastData.dateTime, "YYYY-MM-DD HH:mm:ss", "Asia/Jakarta")
        .toDate();
      //! cek apakah nodeId sudah exist
      const existingRealtime = await Realtime.findOne({
        nodeId: existingNodeSetting._id,
      });
      if (existingRealtime) {
        const previousFilename = existingRealtime.filename;
        const previousFilepath = existingRealtime.filepath;
        //! jika ada update data realtime
        const updateRealtime = await Realtime.updateOne(
          { nodeId: existingNodeSetting._id }, // filter berdasarkan _id
          {
            $set: {
              statusGauge: lastData.statusGauge,
              statusCam: lastData.statusCam,
              pressure: lastData.pressure,
              dateTime: lastData.dateTime,
              createdAt: jakartaDate,
            },
          } // data yang diupdate
        );
        // console.log("previousFilename ", previousFilename)
        // console.log("previousFilepath ", previousFilepath)
        // Cek apakah file ada
        try {
          await fs.existsSync(previousFilepath);
          // Hapus file jika ada
          await fs.unlink(previousFilepath, (err) => {
            if (err) {
              console.error("Gagal menghapus file:", err);
            } else {
              console.log("File berhasil dihapus");
            }
          });
        } catch (fileErr) {
          console.warn("File tidak ditemukan");
        }
      } else {
        //! jika data tidak ada, save data di collection realtime
        const newRealtime = new Realtime({
          nodeId: existingNodeSetting._id,
          statusGauge: lastData.statusGauge,
          statusCam: lastData.statusCam,
          pressure: lastData.pressure,
          dateTime: lastData.dateTime,
          createdAt: jakartaDate,
        });
        await newRealtime.save();
      }

      return res.status(200).json({ message: "Upload data success" });
    } else {
      return res.status(401).json({ message: "Unauthorized" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error uploading file", error: error.message });
  }
};

// Download file by filename
const getNodeSensorImage = async (req, res) => {
  const filename = req.params.filename;
  const userId = req.user.id;

  const upload = await Upload.findOne({ filename, userId });
  if (!upload) {
    return res
      .status(404)
      .json({ message: "File not found or not accessible" });
  }

  const filePath = path.resolve(upload.filepath);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "File not exists on server" });
  }

  res.sendFile(filePath);
};

const getUnit = async (req, res) => {
  try {
    const usernameToken = req.username;
    const UPTparam = req.body.UPT;
    //! cek akun
    const existingUser = await User.findOne({ username: usernameToken });
    //! jika tidak ditemukan user atau blm di verify
    if (!existingUser || !existingUser.isVerify) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    //! hanya admin dan role local yang diijinkan save data
    if (existingUser.isAdmin || existingUser.role === "local") {
      //! cek UPT
      const existingUPT = await UPT.findOne({ UPT: UPTparam });
      if (!existingUPT) {
        return res.status(404).json({ message: "UPT belum terdaftar" });
      }

      const result = await UPT.aggregate([
        {
          $match: { _id: existingUPT._id },
        },
        {
          $lookup: {
            from: "ultgs", // nama collection B (bukan model)
            localField: "_id",
            foreignField: "UPTId",
            as: "ULTGS",
          },
        },
        {
          $unwind: {
            path: "$ULTGS",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "units", // nama collection C (bukan model)
            localField: "ULTGS._id",
            foreignField: "ULTGId",
            as: "ULTGS.unit",
          },
        },
        {
          $group: {
            _id: "$_id",
            UPT: { $first: "$UPT" },
            ULTGS: {
              $push: {
                ULTG: "$ULTGS.ULTG",
                unit: "$ULTGS.unit.unit", // hanya ambil nama unit dari Units
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            UPT: 1,
            ULTGS: 1,
          },
        },
      ]);

      return res.status(200).json({ message: result });
    }

    res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    res.status(500).json({ message: "Unauthorized" });
  }
};
const addUnit = async (req, res) => {
  try {
    const usernameToken = req.username;
    const UPTparam = req.body.UPT;
    const ULTGparam = req.body.ULTG;
    const unitParam = req.body.unit;
    //! cek akun
    const existingUser = await User.findOne({ username: usernameToken });
    //! jika tidak ditemukan user atau blm di verify
    if (!existingUser || !existingUser.isVerify) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    //! hanya admin dan role local yang diijinkan save data
    if (existingUser.isAdmin || existingUser.role === "local") {
      //! cek UPT
      const existingUPT = await UPT.findOne({ UPT: UPTparam });
      if (!existingUPT) {
        return res.status(404).json({ message: "UPT belum terdaftar" });
      }

      //! cek ULTG
      const existingULTG = await ULTG.findOne({
        UPTId: existingUPT._id,
        ULTG: ULTGparam,
      });
      if (!existingULTG) {
        return res.status(404).json({ message: "ULTG belum terdaftar" });
      }

      //! cek Unit
      const existingUnit = await Unit.findOne({
        ULTGId: existingULTG._id,
        unit: unitParam,
      });
      if (existingUnit) {
        return res.status(404).json({ message: "Unit sudah terdaftar" });
      }
      // //! Simpan Unit ke database
      const newUnit = new Unit({
        ULTGId: existingULTG._id, // Referensi ke ULTG
        unit: unitParam,
      });

      await newUnit.save();

      return res.status(200).json({ message: "Unit berhasil disimpan" });
    }

    res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    res.status(500).json({ message: "Unauthorized" });
  }
};

const getNodeUPTULTG = async (req, res) => {
  try {
    const usernameToken = req.username;
    const UPTparam = req.body.UPT;
    const ULTGparam = req.body.ULTG;
    //! cek akun
    const existingUser = await User.findOne({ username: usernameToken });
    //! jika tidak ditemukan user atau blm di verify
    if (!existingUser || !existingUser.isVerify) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    //! hanya admin dan role local yang diijinkan save data
    if (existingUser.isAdmin || existingUser.role === "local") {
      //! cek UPT
      const existingUPT = await UPT.findOne({ UPT: UPTparam });
      if (!existingUPT) {
        return res.status(404).json({ message: "UPT belum terdaftar" });
      }

      //! cek ULTG
      const existingULTG = await ULTG.findOne({
        UPTId: existingUPT._id,
        ULTG: ULTGparam,
      });
      if (!existingULTG) {
        return res.status(404).json({ message: "ULTG belum terdaftar" });
      }

      const result = await NodeSetting.find({
        UPT: UPTparam,
        ULTG: ULTGparam,
      }).select(
        "nodeName UPT ULTG unit brand type gps_lat gps_long zonaInstallation isolasi minScale maxScale minValue maxValue _id"
      );

      return res.status(200).json({ message: result });
    }

    res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    res.status(500).json({ message: "Unauthorized" });
  }
};

const getNodeUPTULTGunit = async (req, res) => {
  try {
    const usernameToken = req.username;
    const UPTparam = req.body.UPT;
    const ULTGparam = req.body.ULTG;
    const unitParam = req.body.unit;

    //! cek akun
    const existingUser = await User.findOne({ username: usernameToken });
    //! jika tidak ditemukan user atau blm di verify
    if (!existingUser || !existingUser.isVerify) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    //! hanya admin dan role local yang diijinkan save data
    if (existingUser.isAdmin || existingUser.role === "local") {
      //! cek UPT
      const existingUPT = await UPT.findOne({ UPT: UPTparam });
      if (!existingUPT) {
        return res.status(404).json({ message: "UPT belum terdaftar" });
      }

      //! cek ULTG
      const existingULTG = await ULTG.findOne({
        UPTId: existingUPT._id,
        ULTG: ULTGparam,
      });
      if (!existingULTG) {
        return res.status(404).json({ message: "ULTG belum terdaftar" });
      }

      //! cek Unit
      const existingUnit = await Unit.findOne({
        ULTGId: existingULTG._id,
        unit: unitParam,
      });
      if (!existingUnit) {
        return res.status(404).json({ message: "Unit belum terdaftar" });
      }

      const result = await NodeSetting.find({
        UPT: UPTparam,
        ULTG: ULTGparam,
        unit: unitParam,
      }).select(
        "nodeName UPT ULTG unit brand type gps_lat gps_long zonaInstallation isolasi minScale maxScale minValue maxValue _id"
      );

      return res.status(200).json({ message: result });
    }

    res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    res.status(500).json({ message: "Unauthorized" });
  }
};

module.exports = {
  getUnit,
  addUnit,
  registerLocal,
  loginLocal,
  addUPT,
  addULTG,
  deleteULTG,
  getUPT,
  getULTG,
  addNode,
  updateNode,
  getNodebyUPT,
  getNodeUPTULTG,
  addNodeSensor,
  getNodeUPTULTGunit,
};
