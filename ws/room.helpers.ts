import { chatRooms } from "./rooms";
import { AuthenticatedWebSocket } from "./types";

export const joinRoom = (chatId: string, ws: AuthenticatedWebSocket) => {
  if (!chatRooms.has(chatId)) {
    chatRooms.set(chatId, new Set());
  }

  chatRooms.get(chatId)!.add(ws);
};

export const leaveAllRooms = (ws: AuthenticatedWebSocket) => {
  for (const [, sockets] of chatRooms) {
    sockets.delete(ws);
  }
};
