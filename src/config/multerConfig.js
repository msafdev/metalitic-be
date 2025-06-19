const multer = require("multer");
const path = require("path");
const fs = require("fs");
const moment = require("moment-timezone");

// ────── Storage Configuration ──────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../../uploads");

    // Ensure upload directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const timestamp = moment().tz("Asia/Jakarta").format("YYYYMMDD_HHmmss");
    const random = Math.random().toString(36).substring(7); // Random alphanumeric string
    const filename = `${timestamp}_${random}${ext}`;

    cb(null, filename);
  },
});

// ────── File Type Filter ──────
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png"];
  const allowedExtensions = [".jpg", ".jpeg", ".png"];

  const isMimeValid = allowedMimeTypes.includes(file.mimetype);
  const isExtValid = allowedExtensions.includes(
    path.extname(file.originalname).toLowerCase()
  );

  if (!isMimeValid || !isExtValid) {
    return cb(
      new Error("Invalid file type. Only .jpg, .jpeg, .png are allowed!"),
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
    fileSize: 5 * 1024 * 1024, // Optional: max 5MB
  },
});

module.exports = upload;
