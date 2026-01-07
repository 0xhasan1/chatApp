import { Schema, model, Types } from "mongoose";

const conversationSchema = new Schema(
  {
    candidateId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },

    supervisorId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },

    agentId: {
      type: Types.ObjectId,
      ref: "User",
      default: null,
    },

    status: {
      type: String,
      enum: ["open", "assigned", "closed"],
      default: "user",
    },

    messages: {
      type: Array,
      default: [],
    },
  },
  { timestamps: true }
);

export const Conversation = model("Conversation", conversationSchema);
