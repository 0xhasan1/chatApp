import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth.middleware";
import { Message } from "../models/Message";
import { Chat } from "../models/Chat";
import { chatRooms } from "../ws/rooms";
import { findOnlineAgent } from "../utils/agentSelector";
import { connectedUsers } from "../ws/store";

const router = Router();

router.post("/create", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== "user") {
      return res.status(403).json({ message: "Only users can create chats" });
    }

    const agentId = findOnlineAgent();

    const chat = await Chat.create({
      userId: req.user.userId,
      agentId: agentId ?? null,
    });

    if (agentId) {
      const agentWs = connectedUsers.get(agentId);

      agentWs?.send(
        JSON.stringify({
          type: "new_chat",
          chatId: chat._id,
          userId: req.user.userId,
        })
      );
    }

    res.status(201).json({
      message: "Chat created",
      chatId: chat._id,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to create chat" });
  }
});

router.get(
  "/:chatId/messages",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { chatId } = req.params;
      const { limit = 20, skip = 0 } = req.query;

      if (!chatId) {
        return res.status(400).json({ message: "Chat ID is required" });
      }

      const chat = await Chat.findById(chatId);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      const userId = req.user!.userId;

      const isUser = chat.userId.toString() === userId;
      const isAgent = chat.agentId?.toString() === userId;

      if (!isUser && !isAgent) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const messages = await Message.find({ chatId })
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit));

      res.json({
        chatId,
        count: messages.length,
        messages,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  }
);

router.post("/:chatId/close", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== "agent") {
      return res.status(403).json({ message: "Only agents can close chats" });
    }

    const { chatId } = req.params;

    if (!chatId) {
      return res.status(404).json({ message: "Chat id not found" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (!chat.agentId || chat.agentId.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized for this chat" });
    }

    if (chat.status === "closed") {
      return res.status(400).json({ message: "Chat already closed" });
    }

    chat.status = "closed";
    await chat.save();

    const room = chatRooms.get(chatId);
    if (room) {
      for (const client of room) {
        client.send(
          JSON.stringify({
            type: "chat_closed",
            chatId,
          })
        );
      }
    }

    res.json({ message: "Chat closed successfully" });
  } catch {
    res.status(500).json({ message: "Failed to close chat" });
  }
});

export default router;
