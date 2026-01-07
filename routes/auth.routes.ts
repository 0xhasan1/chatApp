import { Router } from "express";
import bcrypt from "bcrypt";
import { User } from "../models/User";

import jwt from "jsonwebtoken";
import { generateToken } from "../utils/jwt";
import { error } from "node:console";
import mongoose from "mongoose";

const router = Router();

interface JwtPayload {
  userId: string;
  role: string;
}

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, role, supervisorId } = req.body;

    const ALLOWED_ROLES = ["candidate", "user", "agent", "supervisor", "admin"];

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid request schema" });
    }

    if (!isValidEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid EmailId" });
    }

    const existingUser = await User.findOne({ email });
    // console.log(existingUser);
    if (existingUser) {
      return res
        .status(409)
        .json({ success: false, error: "Email already exists" });
    }

    if (role === "agent") {
      if (!supervisorId) {
        return res.status(400).json({
          success: false,
          error: "Invalid request schema",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(supervisorId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid request schema",
        });
      }

      const supervisor = await User.findById(supervisorId);
      if (!supervisor) {
        return res.status(404).json({
          success: false,
          error: "Supervisor not found",
        });
      }

      if (supervisor.role !== "supervisor") {
        return res.status(400).json({
          success: false,
          error: "Invalid supervisor role",
        });
      }
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        error: "Invalid request schema",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      supervisorId,
    });
    // console.log(user);

    const userData = user.toObject();

    const {
      password: _password,
      createdAt,
      updatedAt,
      __v,
      ...userResponse
    } = userData;

    res.status(201).json({
      success: true,
      data: userResponse,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err,
    });
  }
});

function isValidEmail(email: string): boolean {
  if (!email) return false;

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  return emailRegex.test(email.trim());
}

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }

    if (!isValidEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid EmailId" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized, token missing or invalid",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized, token missing or invalid",
      });
    }

    const token: string = generateToken({
      userId: user._id,
      role: user.role,
    });

    res.status(200).json({
      success: true,
      data: {
        token,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized, token missing or invalid",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized, token missing or invalid",
      });
    }

    let decoded: any;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
      return res.status(401).json({
        success: false,
        error: "Unauthorized, token missing or invalid",
      });
    }

    if (
      typeof decoded !== "object" ||
      !("userId" in decoded) ||
      !("role" in decoded)
    ) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized, token missing or invalid",
      });
    }

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
