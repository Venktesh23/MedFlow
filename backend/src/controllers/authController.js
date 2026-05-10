import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { sendError, sendSuccess } from "../utils/http.js";

function signToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign({ sub: user._id.toString(), email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    clinicName: user.clinicName,
    clinicHoursStart: user.clinicHoursStart,
    clinicHoursEnd: user.clinicHoursEnd,
    specialty: user.specialty,
  };
}

export async function register(req, res) {
  const { name, email, password, clinicName = "", specialty = "" } = req.body;
  const exists = await User.findOne({ email: email.toLowerCase() });

  if (exists) {
    return sendError(res, 409, {
      code: "EMAIL_ALREADY_REGISTERED",
      message: "Email is already registered.",
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name,
    email,
    passwordHash,
    clinicName,
    specialty,
  });

  return sendSuccess(res, {
    token: signToken(user),
    user: publicUser(user),
  }, 201);
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return sendError(res, 401, {
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password.",
    });
  }

  return sendSuccess(res, {
    token: signToken(user),
    user: publicUser(user),
  });
}
