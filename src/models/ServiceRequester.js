const mongoose = require('mongoose');

const ServiceRequesterSchema = new mongoose.Schema({
  nama: { type: String, required: true },
}, { timestamps: true });

ServiceRequesterSchema.index({ nama: 1 });

module.exports = mongoose.model("ServiceRequester", ServiceRequesterSchema);