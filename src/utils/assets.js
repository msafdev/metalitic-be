// const getAssetURL = (filename) => {
//   const host = process.env.APP_URL || `http://localhost:${process.env.PORT}`;
//   return `${host}${filename}`;
// };

const path = require("path");

const getAssetURL = (filename) => {
  const host = process.env.APP_URL || `http://localhost:${process.env.PORT}`;
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".tif" || ext === ".tiff") {
    return `${host}/preview/${path.basename(filename)}`;
  }
  return `${host}${filename}`;
};

module.exports = {
  getAssetURL
}