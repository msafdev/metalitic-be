const mongoose = require("mongoose");

const Ai_ModelSchema = new mongoose.Schema(
  {
    namaModel: { type: String, required: true, unique: true },
    jenisModel: { type: String, required: true },
    namaPembuat: { type: String, required: false },
    fileName: { type: String, required: true },
    notes: { type: String, required: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ai_Model", Ai_ModelSchema);
