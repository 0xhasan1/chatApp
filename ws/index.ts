import WebSocket, { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Conversation } from "../models/conversation";

interface WsUser {
  userId: string;
  role: string;
  joined: Set<string>;
}

interface WsWithUser extends WebSocket {
  user?: WsUser;
}

interface InMemoryConversation {
  participants: Set<WsWithUser>;
  messages: any[];
}

const activeConversations = new Map<string, InMemoryConversation>();

function send(ws: WebSocket, event: string, data: any) {
  ws.send(JSON.stringify({ event, data }));
}

function getTokenFromReq(req: any): string | null {
  const url = req.url || "";
  const params = new URLSearchParams(url.split("?")[1]);
  return params.get("token");
}

function verifyToken(token: string) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!);
  if (
    typeof decoded !== "object" ||
    !("userId" in decoded) ||
    !("role" in decoded)
  ) {
    throw new Error("Invalid token");
  }
  return decoded as { userId: string; role: string };
}

export function initWebSocket(server: any) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws: WsWithUser, req) => {
    try {
      const token = getTokenFromReq(req);
      if (!token) throw new Error();

      const decoded = verifyToken(token);

      ws.user = {
        userId: decoded.userId,
        role: decoded.role,
        joined: new Set(),
      };
    } catch {
      send(ws, "ERROR", { message: "Unauthorized or invalid token" });
      ws.close();
      return;
    }

    ws.on("message", async (raw) => {
      let parsed: any;

      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return send(ws, "ERROR", { message: "Invalid message format" });
      }

      const { event, data } = parsed;
      if (!event) {
        return send(ws, "ERROR", { message: "Unknown event" });
      }

      if (event === "JOIN_CONVERSATION") {
        if (!data?.conversationId) {
          return send(ws, "ERROR", { message: "Invalid request schema" });
        }

        const { conversationId } = data;

        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
          return send(ws, "ERROR", {
            message: "Not allowed to access this conversation",
          });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return send(ws, "ERROR", {
            message: "Not allowed to access this conversation",
          });
        }

        if (conversation.status === "closed") {
          return send(ws, "ERROR", {
            message: "Conversation already closed",
          });
        }

        const { role, userId } = ws.user!;

        if (role === "supervisor" || role === "admin") {
          return send(ws, "ERROR", {
            message: "Forbidden for this role",
          });
        }

        if (
          role === "candidate" &&
          conversation.candidateId.toString() !== userId
        ) {
          return send(ws, "ERROR", {
            message: "Not allowed to access this conversation",
          });
        }

        if (role === "agent" && conversation.agentId?.toString() !== userId) {
          return send(ws, "ERROR", {
            message: "Not allowed to access this conversation",
          });
        }

        // In-memory conversation
        if (!activeConversations.has(conversationId)) {
          activeConversations.set(conversationId, {
            participants: new Set(),
            messages: conversation.messages || [],
          });
        }

        const room = activeConversations.get(conversationId)!;
        room.participants.add(ws);
        ws.user!.joined.add(conversationId);

        send(ws, "JOINED_CONVERSATION", {
          conversationId,
          status: conversation.status,
        });
        return;
      }

      if (event === "SEND_MESSAGE") {
        if (!data?.conversationId || !data?.content) {
          return send(ws, "ERROR", { message: "Invalid request schema" });
        }

        const { conversationId, content } = data;
        const { role, userId } = ws.user!;

        if (role === "supervisor" || role === "admin") {
          return send(ws, "ERROR", {
            message: "Forbidden for this role",
          });
        }

        if (!ws.user!.joined.has(conversationId)) {
          return send(ws, "ERROR", {
            message: "You must join the conversation first",
          });
        }

        const room = activeConversations.get(conversationId);
        if (!room) return;

        const message = {
          conversationId,
          senderId: userId,
          senderRole: role,
          content,
          createdAt: new Date().toISOString(),
        };

        room.messages.push(message);

        for (const client of room.participants) {
          if (client !== ws) {
            send(client, "NEW_MESSAGE", message);
          }
        }
        return;
      }

      if (event === "LEAVE_CONVERSATION") {
        if (!data?.conversationId) {
          return send(ws, "ERROR", { message: "Invalid request schema" });
        }

        const { role } = ws.user!;
        if (role === "supervisor" || role === "admin") {
          return send(ws, "ERROR", {
            message: "Forbidden for this role",
          });
        }

        const { conversationId } = data;
        const room = activeConversations.get(conversationId);
        if (room) {
          room.participants.delete(ws);
        }

        ws.user!.joined.delete(conversationId);

        send(ws, "LEFT_CONVERSATION", { conversationId });
        return;
      }

      if (event === "CLOSE_CONVERSATION") {
        if (!data?.conversationId) {
          return send(ws, "ERROR", { message: "Invalid request schema" });
        }

        const { conversationId } = data;
        const { role, userId } = ws.user!;

        if (role !== "agent") {
          return send(ws, "ERROR", {
            message: "Forbidden for this role",
          });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return send(ws, "ERROR", {
            message: "Not allowed to access this conversation",
          });
        }

        if (conversation.status === "closed") {
          return send(ws, "ERROR", {
            message: "Conversation already closed",
          });
        }

        if (conversation.agentId?.toString() !== userId) {
          return send(ws, "ERROR", {
            message: "Not allowed to access this conversation",
          });
        }

        if (conversation.status !== "assigned") {
          return send(ws, "ERROR", {
            message: "Conversation not yet assigned",
          });
        }

        const room = activeConversations.get(conversationId);
        if (room) {
          conversation.messages = room.messages;
        }

        conversation.status = "closed";
        await conversation.save();

        if (room) {
          for (const client of room.participants) {
            send(client, "CONVERSATION_CLOSED", { conversationId });
          }
          activeConversations.delete(conversationId);
        }

        return;
      }

      send(ws, "ERROR", { message: "Unknown event" });
    });
  });
}
