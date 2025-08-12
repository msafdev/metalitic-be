const multer = require("multer");
const path = require("path");
const fs = require("fs");
const moment = require("moment-timezone");
require("dotenv").config(); // pastikan kamu sudah load .env

// ────── Ambil nama folder dari ENV ──────
const uploadDirFromEnv = process.env.UPLOAD_FOLDER || "uploads";

// ────── Hitung path absolut dari root project ──────
const uploadPath = path.resolve(process.cwd(), uploadDirFromEnv);
// const uploadPath=path.resolve(uploadDirFromEnv)

console.log('dir from multer: ', uploadPath)

// ────── Storage Configuration ──────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Pastikan folder ada
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const timestamp = moment().tz("Asia/Jakarta").format("YYYYMMDD_HHmmss");
    const random = Math.random().toString(36).substring(7);
    const filename = `${timestamp}_${random}${ext}`;

    cb(null, filename);
  },
});

// ────── File Type Filter ──────
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/tiff"];
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".tif", ".tiff"];

  const isMimeValid = allowedMimeTypes.includes(file.mimetype);
  const isExtValid = allowedExtensions.includes(
    path.extname(file.originalname).toLowerCase()
  );

  if (!isMimeValid || !isExtValid) {
    return cb(
      new Error("Invalid file type. Only .jpg, .jpeg, .png, .tif, .tiff are allowed!"),
      false
    );
  }

  cb(null, true);
};

// ────── Multer Middleware ──────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

module.exports = { uploadPath }
module.exports = upload;
