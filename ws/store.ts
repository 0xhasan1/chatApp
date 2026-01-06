import { AuthenticatedWebSocket } from "./types";

export const connectedUsers = new Map<string, AuthenticatedWebSocket>();
