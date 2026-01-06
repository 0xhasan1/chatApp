// const WebSocket = require("ws");
import WebSocket from "ws";

const token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTVkMDk5NWVhMTdiNjQwYjAwOTRkN2MiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NzcyNzY3NCwiZXhwIjoxNzY3ODE0MDc0fQ.p2J-v0N6QJKEP1jSdGuAP3e5-dvC86EBcxAXHjhZcSs";
const chatId = "695d632f296254b16a08535a";

const ws = new WebSocket(`ws://localhost:3000?token=${token}`);

let joined = false;
ws.on("open", () => {
  console.log("WS connected");
  // ws.send("hello secured websocket");

  ws.send(
    JSON.stringify({
      type: "join_chat",
      chatId,
    })
  );

  setTimeout(() => {
    ws.send(
      JSON.stringify({
        type: "message",
        chatId,
        content: "Hello from client, Sir, ok sir bye bye ",
      })
    );
  }, 500);
});

ws.on("message", (data: any) => {
  const msg = JSON.parse(data.toString());

  if (msg.type === "joined_chat" && !joined) {
    joined = true;
    console.log("User joined chat");

    ws.send(
      JSON.stringify({
        type: "message",
        chatId,
        content: "Hello agent ",
      })
    );
  }

  if (msg.type === "message") {
    console.log("Received:", msg.content);
  }
  console.log("from server:", data.toString());
});

ws.on("close", (code: any, reason: any) => {
  console.log("closed:", code, reason.toString());
});
