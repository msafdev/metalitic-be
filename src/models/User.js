const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    nomorInduk: { type: String, required: true },
    devisi: { type: String, required: true },
    jabatan: { type: String, required: true },
    email: { type: String, required: true },
    noHp: { type: String, required: true },
    alamat: { type: String, required: true },
    projects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }],
    avatarUser: { type: String },
    isSuperAdmin: { type: Boolean, required: true },
    isAdmin: { type: Boolean, required: true },
    isVerify: { type: Boolean, required: true },
  },
  { timestamps: true }
);

// Membuat index pada nodeId di koleksi Node untuk pencarian cepat
UserSchema.index({ username: 1 });

module.exports = mongoose.model("User", UserSchema);
