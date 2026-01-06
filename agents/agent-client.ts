import WebSocket from "ws";

const AGENT_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTVkN2NhYWNmZDQ0YjczMDU2ZTMyOTkiLCJyb2xlIjoiYWdlbnQiLCJpYXQiOjE3Njc3MzQ1NDEsImV4cCI6MTc2NzgyMDk0MX0.EQzMU2G09ftl2o5QPgoTzJf5NLmK2BkzEH7izbQX6mo";

const ws = new WebSocket(`ws://localhost:3000?token=${AGENT_TOKEN}`);

ws.on("open", () => {
  console.log("Agent connected to chat server");
});

ws.on("message", (data) => {
  const message = JSON.parse(data.toString());

  if (message.type === "new_chat") {
    console.log("New chat assigned:", message.chatId);

    ws.send(
      JSON.stringify({
        type: "join_chat",
        chatId: message.chatId,
      })
    );
  }

  if (message.type === "message") {
    console.log(
      ` [${message.chatId}] ${message.from.role}: ${message.content}`
    );
  }

  if (message.type === "chat_closed") {
    console.log(`Chat closed: ${message.chatId}`);
  }
});

ws.on("close", () => {
  console.log("Agent disconnected");
});
