import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./db";
import authRoutes from "../routes/auth.routes";
import { initWebSocket } from "../ws/index";
import http from "http";
import chatRoutes from "../routes/chat.routes";

dotenv.config();

const app = express();
app.use(express.json());
const server = http.createServer(app);
initWebSocket(server);

app.use("/auth", authRoutes);
app.use("/user", authRoutes);
app.use("/chat", chatRoutes);

app.get("/health", (_, res) => {
  res.send("OK");
});

connectDB();

server.listen(3000, () => {
  console.log("Server running on port 3000");
});
