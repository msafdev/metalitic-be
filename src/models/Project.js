const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    namaProject: { type: String, required: true },
    permintaanJasa: { type: String, required: true },
    sample: { type: String, required: true },
    tglPengujian: { type: Date, required: true },
    lokasiPengujian: { type: String, required: true },
    areaPengujian: { type: String, required: true },
    posisiPengujian: { type: String, required: true },
    material: { type: String, required: true },
    GritSandWhell: { type: String, required: true },
    ETSA: { type: String, required: true },
    kamera: { type: String, required: true },
    mikrosopMerk: { type: String, required: true },
    mikrosopZoom: { type: String, required: true },
    userArrayId: { type: [String], required: true },
}, { timestamps: true });

UserSchema.index({ userId: 1 });

module.exports = mongoose.model("Project", UserSchema);