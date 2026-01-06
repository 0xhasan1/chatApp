import { connectedUsers } from "../ws/store";

export const findOnlineAgent = () => {
  for (const [userId, ws] of connectedUsers.entries()) {
    if (ws.user?.role === "agent") {
      return userId;
    }
  }
  return null;
};
