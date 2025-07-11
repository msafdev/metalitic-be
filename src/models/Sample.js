const mongoose = require('mongoose');

const HasilUjiSchema = new mongoose.Schema({
  image: {
    type: String,
    required: true
  },
  penguji: {
    type: String,
    required: true
  },
  tanggalUpdate: {
    type: Date,
    required: true
  },
  mode: {
    type: String,
    enum: ["AI", "MANUAL"],
    required: true
  },
  hasilKlasifikasiAI: {
    type: String,
    required: true
  },
  modelAI: {
    type: String,
    required: true
  },
  confidence: {
    type: Number,
    required: true
  },
  hasilKlasifikasiManual: {
    type: String,
    default: null
  }
});

const SampleSchema = new mongoose.Schema(
  {
    image: {
      type: String,
      required: true
    },
    fasa: {
      type: HasilUjiSchema,
      required: true
    },
    crack: {
      type: HasilUjiSchema,
      required: true
    },
    degradasi: {
      type: HasilUjiSchema,
      required: true
    }
  },
  {
    timestamps: true // untuk createdAt dan updatedAt
  }
);

module.exports = mongoose.model("Sample", SampleSchema);
