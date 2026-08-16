import { Router, Request, Response } from "express";
import { prisma } from "../index";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validation";
import { apiCreateSchema } from "../utils/validation-schemas";
import { calculatePrice, canUserCreateApi, incrementAttemptCount } from "../services/pricing/pricing-engine";

const router = Router();

router.post("/", authenticate, validate(apiCreateSchema), async (req: Request, res: Response) => {
  try {
    const { workflowId, apiName, description } = req.body;

    const allowed = await canUserCreateApi(req.user!.userId);
    if (!allowed) {
      res.status(429).json({ error: "Daily API creation limit reached" });
      return;
    }

    await incrementAttemptCount(req.user!.userId);

    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId: req.user!.userId },
      include: { steps: true },
    });
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    const existingApi = await prisma.api.findFirst({ where: { workflowId } });
    if (existingApi) {
      res.status(409).json({ error: "API already exists for this workflow" });
      return;
    }

    const price = await calculatePrice(workflow.steps.length);
    const api = await prisma.api.create({
      data: {
        userId: req.user!.userId,
        apiName,
        description,
        workflowId,
        complexityLevel: workflow.steps.length,
        pricePerCall: price,
      },
      include: { workflow: true },
    });

    res.json({ api });
  } catch (err) {
    res.status(500).json({ error: "Failed to create API" });
  }
});

router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const apis = await prisma.api.findMany({
      where: { userId: req.user!.userId, isActive: true },
      include: { workflow: true, _count: { select: { apiCalls: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ apis });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch APIs" });
  }
});

router.get("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const api = await prisma.api.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: {
        workflow: { include: { steps: { orderBy: { stepOrder: "asc" } }, variables: true } },
      },
    });
    if (!api) {
      res.status(404).json({ error: "API not found" });
      return;
    }
    res.json({ api });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch API" });
  }
});

router.delete("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const api = await prisma.api.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!api) {
      res.status(404).json({ error: "API not found" });
      return;
    }
    await prisma.api.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: "API deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete API" });
  }
});

export default router;
