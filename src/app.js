require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const path = require("path");

const adminRoutes = require("./routes/admin");
const managerRoutes = require("./routes/manager");
const userRoutes = require("./routes/user");
const globalRoutes = require("./routes/global");
// const localRoutes = require("./routes/local");
// const deviceFERoutes = require("./routes/device");

const errorHandler = require("./middlewares/errorHandler");

const app = express();

// ────── Validate Env Config ──────
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI is not defined in .env");
  process.exit(1);
}

// ────── Global Middleware ──────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// ────── Static File Serving ──────
// Enable if using file uploads (e.g., profile images)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ────── Database Connection ──────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// ────── Route Mounting ──────
app.use("/api/v1/superadmin", adminRoutes);
app.use("/api/v1/manager", managerRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1", globalRoutes)
// app.use("/api/v1/local", localRoutes);
// app.use("/api/v1/device", deviceFERoutes);

// ────── Global Error Handler ──────
app.use(errorHandler);

module.exports = app;
