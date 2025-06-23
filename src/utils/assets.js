const getAssetURL = (filename) => {
  const host = process.env.APP_URL || `http://localhost:${process.env.PORT}`;
  return `${host}${filename}`;
};

module.exports = {
  getAssetURL
}