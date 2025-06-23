const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    idProject: { type: String, required: true },
    namaProject: { type: String, required: true },
    pemintaJasa: { type: String, required: true },
    tanggalOrderMasuk: { type: String, required: true },
    penguji: { type: [String], required: true },
}, { timestamps: true });

ProjectSchema.index({ idProject: 1 });

module.exports = mongoose.model("Project", ProjectSchema);