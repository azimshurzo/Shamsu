import { Router, Request, Response } from "express";
import { prisma } from "../index";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validation";
import { voiceParseSchema, voiceCreateSchema } from "../utils/validation-schemas";
import { parseVoiceIntent, VoiceIntent } from "../services/voice/intent-parser";
import { runVoiceProbe } from "../services/voice/probe-agent";
import { canUserCreateApi, incrementAttemptCount } from "../services/pricing/pricing-engine";

const router = Router();

router.post("/parse", authenticate, validate(voiceParseSchema), async (req: Request, res: Response) => {
  try {
    const { transcript } = req.body;
    const intent = await parseVoiceIntent(transcript);
    res.json({ success: true, intent });
  } catch (err: any) {
    res.status(422).json({ error: err.message || "Failed to parse command" });
  }
});

router.post("/create", authenticate, validate(voiceCreateSchema), async (req: Request, res: Response) => {
  try {
    const { transcript, intent } = req.body as { transcript: string; intent: VoiceIntent };

    const allowed = await canUserCreateApi(req.user!.userId);
    if (!allowed) {
      res.status(429).json({ error: "Daily API creation limit reached" });
      return;
    }

    await incrementAttemptCount(req.user!.userId);

    const job = await prisma.voiceJob.create({
      data: {
        userId: req.user!.userId,
        transcript,
        intentJson: intent as any,
      },
    });

    runVoiceProbe(job.id, req.user!.userId, intent).catch((err) => {
      console.error("Voice probe failed:", err);
    });

    res.json({ job });
  } catch (err) {
    res.status(500).json({ error: "Failed to start API creation" });
  }
});

router.get("/jobs/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const job = await prisma.voiceJob.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json({ job });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

export default router;
