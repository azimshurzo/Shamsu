import { Router, Request, Response } from "express";
import { prisma } from "../index";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();
router.use(authenticate, requireAdmin);

router.get("/users", async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        apiCreationAttempts: true,
        createdAt: true,
        _count: { select: { apis: true, paymentRequests: true, workflows: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/payments/pending", async (_req: Request, res: Response) => {
  try {
    const payments = await prisma.paymentRequest.findMany({
      where: { status: "PENDING" },
      include: { user: { select: { id: true, name: true, email: true } }, plan: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ payments });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pending payments" });
  }
});

router.put("/payments/:id/approve", async (req: Request, res: Response) => {
  try {
    const payment = await prisma.paymentRequest.findUnique({
      where: { id: req.params.id },
      include: { plan: true },
    });
    if (!payment || payment.status !== "PENDING") {
      res.status(404).json({ error: "Payment not found or already processed" });
      return;
    }

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + (payment.plan?.durationDays || 30));

    await prisma.$transaction([
      prisma.paymentRequest.update({
        where: { id: req.params.id },
        data: { status: "APPROVED", reviewedAt: new Date(), reviewedBy: req.user!.userId },
      }),
      prisma.user.update({
        where: { id: payment.userId },
        data: { subscriptionStatus: "ACTIVE", subscriptionExpiresAt: expiry },
      }),
    ]);

    res.json({ message: "Payment approved" });
  } catch (err) {
    res.status(500).json({ error: "Failed to approve payment" });
  }
});

router.put("/payments/:id/reject", async (req: Request, res: Response) => {
  try {
    const payment = await prisma.paymentRequest.findUnique({ where: { id: req.params.id } });
    if (!payment || payment.status !== "PENDING") {
      res.status(404).json({ error: "Payment not found or already processed" });
      return;
    }

    await prisma.paymentRequest.update({
      where: { id: req.params.id },
      data: { status: "REJECTED", reviewedAt: new Date(), reviewedBy: req.user!.userId },
    });

    res.json({ message: "Payment rejected" });
  } catch (err) {
    res.status(500).json({ error: "Failed to reject payment" });
  }
});

router.get("/pricing", async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { startsWith: "pricing_" } },
    });
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pricing" });
  }
});

router.put("/pricing", async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }
    res.json({ message: "Pricing updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update pricing" });
  }
});

router.get("/settings", async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.systemSetting.findMany();
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.put("/settings", async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }
    res.json({ message: "Settings updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalApis = await prisma.api.count();
    const totalCalls = await prisma.apiCall.count();
    const pendingPayments = await prisma.paymentRequest.count({ where: { status: "PENDING" } });
    const totalRevenue = await prisma.paymentRequest.aggregate({
      where: { status: "APPROVED" },
      _sum: { amount: true },
    });

    res.json({
      totalUsers,
      totalApis,
      totalCalls,
      pendingPayments,
      totalRevenue: totalRevenue._sum.amount || 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get("/plans", async (_req: Request, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({ orderBy: { durationDays: "asc" } });
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

router.post("/plans", async (req: Request, res: Response) => {
  try {
    const { planName, priceBdt, durationDays } = req.body;
    const plan = await prisma.plan.create({
      data: { planName, priceBdt, durationDays },
    });
    res.json({ plan });
  } catch (err) {
    res.status(500).json({ error: "Failed to create plan" });
  }
});

router.put("/plans/:id", async (req: Request, res: Response) => {
  try {
    const { planName, priceBdt, durationDays, active } = req.body;
    const plan = await prisma.plan.update({
      where: { id: req.params.id },
      data: { planName, priceBdt, durationDays, active },
    });
    res.json({ plan });
  } catch (err) {
    res.status(500).json({ error: "Failed to update plan" });
  }
});

router.delete("/plans/:id", async (req: Request, res: Response) => {
  try {
    await prisma.plan.delete({ where: { id: req.params.id } });
    res.json({ message: "Plan deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete plan" });
  }
});

export default router;
