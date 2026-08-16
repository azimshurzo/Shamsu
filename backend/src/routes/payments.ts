import { Router, Request, Response } from "express";
import { prisma } from "../index";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validation";
import { paymentSubmitSchema } from "../utils/validation-schemas";

const router = Router();

router.get("/plans", async (_req: Request, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { active: true },
      orderBy: { durationDays: "asc" },
    });
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

router.post("/", authenticate, validate(paymentSubmitSchema), async (req: Request, res: Response) => {
  try {
    const { planId, transactionId, bkashNumber } = req.body;

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    const existing = await prisma.paymentRequest.findFirst({
      where: { transactionId, status: "PENDING" },
    });
    if (existing) {
      res.status(409).json({ error: "Transaction ID already submitted" });
      return;
    }

    const payment = await prisma.paymentRequest.create({
      data: {
        userId: req.user!.userId,
        planId,
        transactionId,
        bkashNumber,
        amount: plan.priceBdt,
      },
    });

    res.json({ payment });
  } catch (err) {
    res.status(500).json({ error: "Failed to submit payment" });
  }
});

router.get("/my", authenticate, async (req: Request, res: Response) => {
  try {
    const payments = await prisma.paymentRequest.findMany({
      where: { userId: req.user!.userId },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ payments });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

export default router;
