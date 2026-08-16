import { Router, Request, Response } from "express";
import { prisma } from "../index";
import { authenticate } from "../middleware/auth";
import { decrypt } from "../services/encryption/crypto";
import { executeWorkflow } from "../services/workflow/executor";

const router = Router();

router.post("/:apiId/run", authenticate, async (req: Request, res: Response) => {
  try {
    const { apiId } = req.params;
    const { variables } = req.body;

    const api = await prisma.api.findFirst({
      where: { id: apiId, userId: req.user!.userId },
      include: {
        workflow: {
          include: { steps: { orderBy: { stepOrder: "asc" } }, variables: true },
        },
      },
    });
    if (!api) {
      res.status(404).json({ error: "API not found" });
      return;
    }

    const decryptedSteps = api.workflow.steps.map((step) => ({
      ...step,
      value: step.value && step.value.includes(":") ? tryDecrypt(step.value) : step.value,
    }));

    const call = await prisma.apiCall.create({
      data: {
        apiId,
        userId: req.user!.userId,
        callCost: api.pricePerCall,
        status: "PENDING",
      },
    });

    try {
      const result = await executeWorkflow(decryptedSteps, variables, api.workflow.variables);
      await prisma.apiCall.update({
        where: { id: call.id },
        data: { status: "SUCCESS", resultJson: result },
      });
      res.json({ executionId: call.id, status: "SUCCESS", result });
    } catch (execErr: any) {
      await prisma.apiCall.update({
        where: { id: call.id },
        data: { status: "FAILED", resultJson: { error: execErr.message } },
      });
      res.status(500).json({ executionId: call.id, status: "FAILED", error: execErr.message });
    }
  } catch (err) {
    res.status(500).json({ error: "Execution failed" });
  }
});

router.get("/:apiId/history", authenticate, async (req: Request, res: Response) => {
  try {
    const calls = await prisma.apiCall.findMany({
      where: { apiId: req.params.apiId, userId: req.user!.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ calls });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch execution history" });
  }
});

function tryDecrypt(value: string): string {
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

export default router;
