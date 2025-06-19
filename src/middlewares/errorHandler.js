const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const env = process.env.NODE_ENV || "development";

  // Handle known error: e.g. file upload validation
  if (err instanceof Error && err.message.includes("Invalid file type")) {
    return res.status(400).json({ message: err.message });
  }

  // Optional: Add more known error types here if needed
  // e.g., Mongoose validation, JWT errors, etc.

  const response = {
    message: err.message || "Internal Server Error",
    ...(env === "development" && { stack: err.stack }),
  };

  if (env === "development") {
    console.error("❌ Error:", err); // Full error log only in dev
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
