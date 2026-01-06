import { Chat } from "../models/Chat";

export const authorizeChatAccess = async (
  chatId: string,
  userId: string,
  role: "user" | "agent"
) => {
  const chat = await Chat.findById(chatId);
  if (!chat) return null;

  if (role === "user") {
    if (chat.userId.toString() !== userId) return null;
  }

  if (role === "agent") {
    if (!chat.agentId || chat.agentId.toString() !== userId) return null;
  }

  return chat;
};
