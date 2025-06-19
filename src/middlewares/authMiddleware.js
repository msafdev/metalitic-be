const jwt = require("jsonwebtoken");
const Session = require("../models/Session");
const User = require("../models/User");

const authenticate = async (req, res, next) => {
  try {
    const { token, role } = req.cookies;

    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided" });
    }

    // Resolve secret based on user role
    const secrets = {
      superadmin: process.env.JWT_SECRET_ADMIN,
      supervisor: process.env.JWT_SECRET_MANAGER,
      default: process.env.JWT_SECRET,
    };
    const secret = secrets[role] || secrets.default;

    // Decode token
    const decoded = jwt.verify(token, secret);
    const { username } = decoded;

    // Find user and session
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }

    const session = await Session.findOne({ userId: user._id, token });
    if (!session) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Session expired or invalid" });
    }

    // Attach user to request
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
