import { AuthenticatedWebSocket } from "./types";

export const chatRooms = new Map<string, Set<AuthenticatedWebSocket>>();
