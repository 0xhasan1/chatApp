import { WebSocketServer, WebSocket } from "ws";
import jwt, { JwtPayload } from "jsonwebtoken";
import { AuthenticatedWebSocket } from "./types";
import { connectedUsers } from "./store";
import { joinRoom, leaveAllRooms } from "./room.helpers";
import { Chat } from "../models/Chat";
import { chatRooms } from "./rooms";
import { Message } from "../models/Message";

interface MyJwtPayload extends JwtPayload {
  userId: string;
  role: string;
}

export const initWebSocket = (server: any) => {
  const wss = new WebSocketServer({ server });

  console.log("WebSocket server initialized");

  wss.on("connection", (ws: AuthenticatedWebSocket, req) => {
    console.log("New WebSocket connection");

    try {
      const url = req.url;
      const params = new URLSearchParams(url?.split("?")[1]);
      const token = params.get("token");

      if (!token) {
        ws.close(1008, "Token missing");
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET as string);

      if (
        !decoded ||
        typeof decoded === "string" ||
        !("userId" in decoded) ||
        !("role" in decoded)
      ) {
        ws.close(1008, "Invalid token");
        return;
      }

      const payload = decoded as MyJwtPayload;

      ws.user = {
        userId: payload.userId,
        role: payload.role,
      };

      console.log(
        `WS Authenticated: userId=${payload.userId}, role=${payload.role}`
      );

      ws.on("message", async (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === "join_chat") {
          const { chatId } = message;

          if (!chatId) {
            ws.send(JSON.stringify({ error: "chatId required" }));
            return;
          }

          const chat = await Chat.findById(chatId);
          if (!chat) {
            ws.send(JSON.stringify({ error: "Chat not found" }));
            return;
          }

          if (chat.status === "closed") {
            ws.send(JSON.stringify({ error: "Chat is closed" }));
            return;
          }

          const userId = ws.user!.userId;

          const isUser = chat.userId.toString() === userId;

          const isAgent = chat.agentId?.toString() === userId;

          if (!isUser && !isAgent) {
            ws.send(JSON.stringify({ error: "Not authorized for this chat" }));
            return;
          }

          joinRoom(chatId, ws);

          console.log(`User ${userId} joined chat ${chatId}`);

          ws.send(
            JSON.stringify({
              type: "joined_chat",
              chatId,
            })
          );
        }
        /////////////////////

        if (message.type === "message") {
          const { chatId, content } = message;

          if (!chatId || !content) {
            ws.send(JSON.stringify({ error: "chatId and content required" }));
            return;
          }

          const room = chatRooms.get(chatId);

          if (!room || !room.has(ws)) {
            ws.send(JSON.stringify({ error: "You are not part of this chat" }));
            return;
          }

          const savedMessage = await Message.create({
            chatId,
            senderId: ws.user!.userId,
            senderRole: ws.user!.role,
            content,
          });

          const payload = {
            type: "message",
            chatId,
            messageId: savedMessage._id,
            from: {
              userId: ws.user!.userId,
              role: ws.user!.role,
            },
            content: savedMessage.content,
            createdAt: savedMessage.createdAt,
          };

          for (const client of room) {
            if (client.readyState === client.OPEN) {
              client.send(JSON.stringify(payload));
            }
          }
        }
      });

      // ws.on("close", () => {
      //   console.log("WebSocket disconnected");
      // });
      ws.on("close", () => {
        leaveAllRooms(ws);

        if (ws.user?.userId) {
          connectedUsers.delete(ws.user.userId);
          console.log(`Disconnected: ${ws.user.userId}`);
        }
      });
    } catch (err) {
      ws.close(1008, "Authentication failed");
    }
  });
};
