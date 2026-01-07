import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Conversation } from "../models/conversation";
import { User } from "../models/User";

const router = express.Router();

interface JwtPayload {
  userId: string;
  role: string;
}

function getAuth(req: express.Request): JwtPayload | null {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as unknown as JwtPayload;

    return decoded;
  } catch {
    return null;
  }
}

router.post("/", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return res.status(401).json({ success: false });
    }

    if (auth.role !== "candidate") {
      return res.status(403).json({
        success: false,
        error: "Forbidden, insufficient permissions",
      });
    }

    const { supervisorId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(supervisorId)) {
      return res.status(400).json({ success: false });
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

    const existingConversation = await Conversation.findOne({
      candidateId: auth.userId,
      status: { $in: ["open", "assigned"] },
    });

    if (existingConversation) {
      return res.status(409).json({
        success: false,
        error: "Candidate already has an active conversation",
      });
    }

    const conversation = await Conversation.create({
      candidateId: auth.userId,
      supervisorId,
      status: "open",
      messages: [],
    });

    res.status(201).json({
      success: true,
      data: conversation,
    });
  } catch {
    res.status(500).json({ success: false });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return res.status(401).json({ success: false });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    const userId = auth.userId;
    const role = auth.role;

    let allowed = false;

    if (role === "admin") allowed = true;

    if (
      role === "candidate" &&
      conversation.candidateId.toString() === userId
    ) {
      allowed = true;
    }

    if (
      role === "supervisor" &&
      conversation.supervisorId.toString() === userId
    ) {
      allowed = true;
    }

    if (
      role === "agent" &&
      conversation.agentId &&
      conversation.agentId.toString() === userId
    ) {
      allowed = true;
    }

    if (!allowed) {
      return res.status(403).json({ success: false });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: conversation._id,
        candidateId: conversation.candidateId,
        supervisorId: conversation.supervisorId,
        agentId: conversation.agentId,
        messages: conversation.messages || [],
      },
    });
  } catch {
    res.status(500).json({ success: false });
  }
});

router.post("/:id/assign", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return res.status(401).json({ success: false });
    }

    if (auth.role !== "supervisor") {
      return res.status(403).json({ success: false });
    }

    const { id } = req.params;
    const { agentId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    if (conversation.supervisorId.toString() !== auth.userId) {
      return res.status(403).json({ success: false });
    }

    if (conversation.status === "closed") {
      return res.status(400).json({
        success: false,
        error: "Conversation already closed",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return res.status(400).json({ success: false });
    }

    const agent = await User.findById(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: "Agent not found",
      });
    }

    if (agent.role !== "agent") {
      return res.status(400).json({
        success: false,
        error: "Invalid agent role",
      });
    }

    if (
      !agent.supervisorId ||
      agent.supervisorId.toString() !== conversation.supervisorId.toString()
    ) {
      return res.status(403).json({
        success: false,
        error: "Agent doesn't belong to you",
      });
    }

    conversation.agentId = agent._id;
    conversation.status = "assigned";
    await conversation.save();

    return res.status(200).json({
      success: true,
      data: {
        conversationId: conversation._id,
        agentId: conversation.agentId,
        supervisorId: conversation.supervisorId,
      },
    });
  } catch {
    return res.status(500).json({ success: false });
  }
});

router.post("/:id/close", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth) {
      return res.status(401).json({ success: false });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    if (conversation.status === "closed") {
      return res.status(400).json({
        success: false,
        error: "Conversation already closed",
      });
    }

    if (conversation.status !== "open") {
      return res.status(400).json({ success: false });
    }

    if (
      auth.role === "admin" ||
      (auth.role === "supervisor" &&
        conversation.supervisorId.toString() === auth.userId)
    ) {
      conversation.status = "closed";
      await conversation.save();

      return res.status(200).json({
        success: true,
        data: {
          conversationId: conversation._id,
          status: conversation.status,
        },
      });
    }

    return res.status(403).json({ success: false });
  } catch {
    res.status(500).json({ success: false });
  }
});

export default router;
