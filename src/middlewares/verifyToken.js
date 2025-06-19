const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const { token, role } = req.cookies;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  try {
    // Choose secret based on role
    const secrets = {
      superadmin: process.env.JWT_SECRET_ADMIN,
      default: process.env.JWT_SECRET,
    };
    const secret = secrets[role] || secrets.default;

    // Verify token
    const decoded = jwt.verify(token, secret);
    req.username = decoded.username;

    next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Unauthorized: Invalid or expired token" });
  }
};

module.exports = verifyToken;
