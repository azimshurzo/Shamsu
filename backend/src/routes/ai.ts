import { Router, Request, Response } from "express";
import { ollamaClient } from "../services/ai/ollama-client";
import { aiAnalyzer } from "../services/ai/analyzer";
import { aiHealerVision } from "../services/ai/healer-vision";

const router = Router();

router.get("/health", async (req: Request, res: Response) => {
  try {
    const isAvailable = await ollamaClient.isAvailable();
    const models = isAvailable ? await ollamaClient.getModels() : [];

    const hasLlama3_2 = models.some(
      (m) => m.name === "llama3.2" || m.name.startsWith("llama3.2:")
    );
    const hasLlava = models.some(
      (m) => m.name === "llava" || m.name.startsWith("llava:")
    );

    res.json({
      status: isAvailable ? "connected" : "disconnected",
      url: process.env.OLLAMA_URL || "http://127.0.0.1:11434",
      models: models.map((m) => ({
        name: m.name,
        size: m.size,
        parameterSize: m.details?.parameter_size,
      })),
      capabilities: {
        textAnalysis: hasLlama3_2,
        visionHealing: hasLlava,
        agentHealing: hasLlama3_2,
      },
      recommendations: !isAvailable
        ? [
            "Install Ollama: brew install ollama",
            "Start Ollama: ollama serve",
            "Pull text model: ollama pull llama3.2",
            "Pull vision model: ollama pull llava",
          ]
        : !hasLlama3_2
        ? ["Pull text model: ollama pull llama3.2"]
        : !hasLlava
        ? ["Pull vision model: ollama pull llava"]
        : [],
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to check Ollama health",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { events, pageUrl, pageTitle } = req.body;

    if (!events || !Array.isArray(events)) {
      res.status(400).json({ error: "Events array is required" });
      return;
    }

    if (!pageUrl) {
      res.status(400).json({ error: "Page URL is required" });
      return;
    }

    const isAvailable = await aiAnalyzer.isAvailable();
    if (!isAvailable) {
      res.status(503).json({
        error: "AI analysis unavailable",
        message:
          "Ollama not running or required models not installed. Install Ollama and pull llama3.2 model.",
      });
      return;
    }

    const analysis = await aiAnalyzer.analyzeWorkflow(
      events,
      pageUrl,
      pageTitle || ""
    );

    res.json({
      success: true,
      analysis,
      model: "llama3.2",
    });
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({
      error: "Analysis failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/optimize", async (req: Request, res: Response) => {
  try {
    const { workflow } = req.body;

    if (!workflow) {
      res.status(400).json({ error: "Workflow object is required" });
      return;
    }

    const isAvailable = await aiAnalyzer.isAvailable();
    if (!isAvailable) {
      res.status(503).json({
        error: "AI optimization unavailable",
        message: "Ollama not running or required models not installed.",
      });
      return;
    }

    const optimization = await aiAnalyzer.optimizeWorkflow(workflow);

    res.json({
      success: true,
      optimization,
      model: "llama3.2",
    });
  } catch (error) {
    console.error("Optimization error:", error);
    res.status(500).json({
      error: "Optimization failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/detect-patterns", async (req: Request, res: Response) => {
  try {
    const { pageHtml } = req.body;

    if (!pageHtml) {
      res.status(400).json({ error: "Page HTML is required" });
      return;
    }

    const isAvailable = await aiAnalyzer.isAvailable();
    if (!isAvailable) {
      res.status(503).json({
        error: "AI pattern detection unavailable",
        message: "Ollama not running or required models not installed.",
      });
      return;
    }

    const patterns = await aiAnalyzer.detectExtractionPatterns(pageHtml);

    res.json({
      success: true,
      patterns,
      model: "llama3.2",
    });
  } catch (error) {
    console.error("Pattern detection error:", error);
    res.status(500).json({
      error: "Pattern detection failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/healing-status", async (req: Request, res: Response) => {
  try {
    const isAvailable = await aiHealerVision.isAvailable();

    res.json({
      available: isAvailable,
      models: {
        vision: await ollamaClient.hasModel("llava"),
        agent: await ollamaClient.hasModel("llama3.2"),
      },
    });
  } catch (error) {
    res.status(500).json({
      available: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
