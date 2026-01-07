import { Router } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { Conversation } from "../models/conversation";

const router = Router();

interface JwtPayload {
  userId: string;
  role: string;
}

function getAuth(req: any): JwtPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.split(" ")[1];
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    if (
      typeof decoded !== "object" ||
      !("userId" in decoded) ||
      !("role" in decoded)
    ) {
      return null;
    }
    return decoded as JwtPayload;
  } catch {
    return null;
  }
}

router.get("/analytics", async (req, res) => {
  try {
    const auth = getAuth(req);

    if (!auth) {
      return res.status(401).json({ success: false });
    }

    if (auth.role !== "admin") {
      return res.status(403).json({ success: false });
    }

    const supervisors = await User.find({ role: "supervisor" });

    const analytics = await Promise.all(
      supervisors.map(async (supervisor) => {
        const agentsCount = await User.countDocuments({
          role: "agent",
          supervisorId: supervisor._id.toString(),
        });

        const conversationsHandled = await Conversation.countDocuments({
          supervisorId: supervisor._id,
          status: "closed",
        });

        return {
          supervisorId: supervisor._id,
          supervisorName: supervisor.name,
          agents: agentsCount,
          conversationsHandled,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch {
    return res.status(500).json({ success: false });
  }
});

export default router;
