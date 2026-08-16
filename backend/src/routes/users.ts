import { Router, Request, Response } from "express";
import { prisma } from "../index";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        subscriptionStatus: true,
        apiCreationAttempts: true,
        createdAt: true,
        _count: { select: { apis: true, paymentRequests: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/stats", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const apiCount = await prisma.api.count({ where: { userId } });
    const callCount = await prisma.apiCall.count({ where: { userId } });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { apiCreationAttempts: true, subscriptionStatus: true },
    });

    res.json({
      apiCount,
      callCount,
      apiCreationAttempts: user?.apiCreationAttempts || 0,
      subscriptionStatus: user?.subscriptionStatus || "FREE",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
