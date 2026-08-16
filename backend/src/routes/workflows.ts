import { Router, Request, Response } from "express";
import { prisma } from "../index";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validation";
import { workflowImportSchema, workflowUpdateSchema } from "../utils/validation-schemas";

const router = Router();

router.post("/import", authenticate, validate(workflowImportSchema), async (req: Request, res: Response) => {
  try {
    const { name, steps, extractionTargets } = req.body;

    const stepData = steps.map((s: any, i: number) => {
      return {
        stepOrder: i + 1,
        actionType: s.actionType,
        selector: s.selector,
        value: s.value,
        url: s.url,
        context: s.context || null,
        text: s.text || null,
        isExtractionTarget: false,
      };
    });

    for (const target of extractionTargets || []) {
      stepData.push({
        stepOrder: stepData.length + 1,
        actionType: "CLICK" as any,
        selector: target.selector,
        value: null,
        url: target.url,
        context: target.label || null,
        text: null,
        isExtractionTarget: true,
        containerSelector: target.containerSelector || null,
        fieldName: target.fieldName || target.label || null,
      });
    }

    const workflow = await prisma.workflow.create({
      data: {
        userId: req.user!.userId,
        name,
        steps: { create: stepData },
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    res.json({ workflow });
  } catch (err) {
    res.status(500).json({ error: "Failed to import workflow" });
  }
});

router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const workflows = await prisma.workflow.findMany({
      where: { userId: req.user!.userId },
      include: { steps: { orderBy: { stepOrder: "asc" } }, variables: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ workflows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch workflows" });
  }
});

router.get("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const workflow = await prisma.workflow.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: { steps: { orderBy: { stepOrder: "asc" } }, variables: true },
    });
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }
    res.json({ workflow });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch workflow" });
  }
});

router.put("/:id", authenticate, validate(workflowUpdateSchema), async (req: Request, res: Response) => {
  try {
    const { name, steps, variables } = req.body;
    const existing = await prisma.workflow.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!existing) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    if (name) {
      await prisma.workflow.update({ where: { id: req.params.id }, data: { name } });
    }

    if (steps) {
      // Collect IDs of steps being kept
      const keptStepIds = steps.filter((s: any) => s.id).map((s: any) => s.id);

      // Delete steps that are no longer in the array
      await prisma.workflowStep.deleteMany({
        where: {
          workflowId: req.params.id,
          id: { notIn: keptStepIds },
        },
      });

      // Update remaining steps with new order and properties
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (step.id) {
          await prisma.workflowStep.update({
            where: { id: step.id },
            data: {
              stepOrder: i + 1,
              isConstant: step.isConstant,
              isExtractionTarget: step.isExtractionTarget,
              containerSelector: step.containerSelector,
              fieldSelector: step.fieldSelector,
              fieldName: step.fieldName,
              context: step.context,
              text: step.text,
              extractAll: step.extractAll,
            },
          });
        }
      }
    }

    if (variables) {
      await prisma.workflowVariable.deleteMany({ where: { workflowId: req.params.id } });
      await prisma.workflowVariable.createMany({
        data: variables.map((v: any) => ({
          workflowId: req.params.id,
          stepId: v.stepId,
          variableName: v.variableName,
          defaultValue: v.defaultValue,
          required: v.required ?? true,
        })),
      });
    }

    const updated = await prisma.workflow.findUnique({
      where: { id: req.params.id },
      include: { steps: { orderBy: { stepOrder: "asc" } }, variables: true },
    });
    res.json({ workflow: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to update workflow" });
  }
});

router.delete("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const existing = await prisma.workflow.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!existing) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }
    await prisma.workflow.delete({ where: { id: req.params.id } });
    res.json({ message: "Workflow deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete workflow" });
  }
});

export default router;
