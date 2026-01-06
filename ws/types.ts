import WebSocket from "ws";

export interface AuthenticatedWebSocket extends WebSocket {
  user?: {
    userId: string;
    role: string;
  };
}
