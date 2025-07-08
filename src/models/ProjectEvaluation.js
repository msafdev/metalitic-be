const mongoose = require('mongoose');

const ProjectEvaluationSchema = new mongoose.Schema({
  id: { type: String, required: true },
  projectId: { type: String, required: true },
  nama: { type: String, required: true },
  status: {
    type: String,
    enum: ['DRAFT', 'PENDING', 'PROCESSING', 'COMPLETED'],
    default: 'DRAFT',
    required: true
  },
  tanggal: { type: String },
  lokasi: { type: String },
  area: { type: String },
  posisi: { type: String },
  material: { type: String },
  gritSandWhell: { type: String },
  etsa: { type: String },
  kamera: { type: String },
  merkMikroskop: { type: String },
  perbesaranMikroskop: { type: String },
  gambarKomponent1: { type: String },
  gambarKomponent2: { type: String },
  listGambarStrukturMikro: { type: [String] },
  aiModelFasa: { type: String },
  aiModelCrack: { type: String },
  aiModelDegradasi: { type: String },
  isAnalyzed: { type: Boolean, default: false },
  lastActive: { type: Date, default: Date.now },
}, { timestamps: true });

ProjectEvaluationSchema.index({ id: 1 });

module.exports = mongoose.model("ProjectEvaluation", ProjectEvaluationSchema);