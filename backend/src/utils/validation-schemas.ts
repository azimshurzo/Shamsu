import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const workflowImportSchema = z.object({
  name: z.string().min(1).max(100),
  steps: z.array(
    z.object({
      actionType: z.enum(["NAVIGATE", "INPUT", "CLICK", "SCROLL", "WAIT", "SELECT"]),
      selector: z.string(),
      value: z.string().optional(),
      url: z.string().optional(),
      context: z.string().optional().nullable(),
      text: z.string().optional().nullable(),
      container: z.object({
        selector: z.string(),
        count: z.number(),
      }).optional().nullable(),
    })
  ),
  extractionTargets: z.array(
    z.object({
      selector: z.string(),
      label: z.string().optional(),
      fieldName: z.string().optional(),
      containerSelector: z.string().optional().nullable(),
      containerCount: z.number().optional(),
      url: z.string().optional(),
    })
  ).optional(),
});

export const apiCreateSchema = z.object({
  workflowId: z.string().uuid(),
  apiName: z.string().min(3).max(50),
  description: z.string().max(500).optional(),
});

export const paymentSubmitSchema = z.object({
  planId: z.string(),
  transactionId: z.string().min(1),
  bkashNumber: z.string().min(11).max(14),
});

export const workflowUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  steps: z
    .array(
      z.object({
        id: z.string().optional(),
        stepOrder: z.number(),
        isConstant: z.boolean(),
        isExtractionTarget: z.boolean().optional().default(false),
        containerSelector: z.string().nullable().optional(),
        fieldSelector: z.string().nullable().optional(),
        fieldName: z.string().nullable().optional(),
        context: z.string().nullable().optional(),
        text: z.string().nullable().optional(),
        extractAll: z.boolean().optional(),
      })
    )
    .optional(),
  variables: z
    .array(
      z.object({
        stepId: z.string().optional(),
        variableName: z.string(),
        defaultValue: z.string().optional(),
        required: z.boolean().optional(),
      })
    )
    .optional(),
});

export const executeApiSchema = z.object({
  variables: z.record(z.string()),
});
