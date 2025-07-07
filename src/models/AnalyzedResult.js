const mongoose = require("mongoose");

const AnalyzedDetailSchema = new mongoose.Schema({
  image: String,
  fasa: {
    image: String,
    penguji: String,
    tanggalUpdate: Date,
    mode: { type: String, enum: ["AI", "MANUAL"] },
    hasilKlasifikasiAI: String,
    modelAI: String,
    confidence: Number,
    hasilKlasifikasiManual: { type: String, default: null }
  },
  crack: {
    image: String,
    penguji: String,
    tanggalUpdate: Date,
    mode: { type: String, enum: ["AI", "MANUAL"] },
    hasilKlasifikasiAI: String,
    modelAI: String,
    confidence: Number,
    hasilKlasifikasiManual: { type: String, default: null }
  },
  degradasi: {
    image: String,
    penguji: String,
    tanggalUpdate: Date,
    mode: { type: String, enum: ["AI", "MANUAL"] },
    hasilKlasifikasiAI: String,
    modelAI: String,
    confidence: Number,
    hasilKlasifikasiManual: { type: String, default: null }
  }
});

const AnalyzedResultSchema = new mongoose.Schema(
  {
    projectEvaluationId: { type: String, required: true },
    projectId: { type: String, required: true },
    nama: String,
    status: String,
    progress: Number,
    detail: {
      pemintaJasa: String,
      tanggalOrderMasuk: String,
      lokasi: String,
      area: String,
      posisi: String,
      material: String,
      gritSandWhell: String,
      etsa: String,
      kamera: String,
      merkMikroskop: String,
      perbesaranMikroskop: String,
      gambarKomponent1: String,
      gambarKomponent2: String,
    },
    hasilAnalisa: [AnalyzedDetailSchema],
    kesimpulan: {
      strukturMikro: String,
      fiturMikroskopik: String,
      damageClass: String,
      hardness: String,
      rekomendasi: String
    },
    penguji: [String],
    pemeriksa: [String]
  },
  { timestamps: true }
);

module.exports = mongoose.model("AnalyzedResult", AnalyzedResultSchema);
