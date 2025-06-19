const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true },
    employeeId: { type: String, required: true },
    division: { type: String, required: true },
    position: { type: String, required: true },
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    address: { type: String, required: true },
    projects: { type: [String], required: true },
    filename: { type: String, required: true },
    filepath: { type: String, required: true },
    isSuperAdmin: { type: Boolean, required: true },
    isAdmin: { type: Boolean, required: true },
    isVerified: { type: Boolean, required: true },
  },
  { timestamps: true }
);

// Index username for fast lookup
UserSchema.index({ username: 1 });

module.exports = mongoose.model("User", UserSchema);
