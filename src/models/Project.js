const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema(
  {
    projectName: { type: String, required: true },
    serviceRequest: { type: String, required: true },
    sample: { type: String, required: true },
    testDate: { type: Date, required: true },
    testLocation: { type: String, required: true },
    testArea: { type: String, required: true },
    testPosition: { type: String, required: true },
    material: { type: String, required: true },
    gritSandWheel: { type: String, required: true },
    etsa: { type: String, required: true },
    camera: { type: String, required: true },
    microscopeBrand: { type: String, required: true },
    microscopeZoom: { type: String, required: true },
    userIds: { type: [String], required: true },
  },
  { timestamps: true }
);

// Remove this index if `userId` field doesn't exist
ProjectSchema.index({ userId: 1 });

module.exports = mongoose.model("Project", ProjectSchema);
