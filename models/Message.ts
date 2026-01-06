import { Schema, model, Types } from "mongoose";

const messageSchema = new Schema(
  {
    chatId: {
      type: Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    senderId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["user", "agent"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export const Message = model("Message", messageSchema);
