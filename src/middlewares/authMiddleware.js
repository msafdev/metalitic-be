const jwt = require("jsonwebtoken");
const Session = require("../models/Session");
const User = require("../models/User");

const authenticate = async (req, res, next) => {
  try {
    const { token, role } = req.cookies;

    console.log({ token, role });

    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided" });
    }

    const secrets = {
      superadmin: process.env.JWT_SECRET_ADMIN,
      supervisor: process.env.JWT_SECRET_MANAGER,
      default: process.env.JWT_SECRET,
    };
    const secret = secrets[role.toLowerCase()] || secrets.default;

    // Decode token
    const decoded = jwt.verify(token, secret);
    const { username } = decoded;

    // Find user and session
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }

    req.existingUser = user;
    next();
  } catch (error) {
    console.error("❌ Authentication error:", error.message);
    return res
      .status(401)
      .json({ message: "Unauthorized: Invalid token or session" });
  }
};

module.exports = authenticate;
