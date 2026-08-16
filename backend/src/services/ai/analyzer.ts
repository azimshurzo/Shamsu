import { ollamaClient } from "./ollama-client";
import {
  ANALYSIS_SYSTEM_PROMPT,
  ANALYSIS_USER_PROMPT,
  WORKFLOW_OPTIMIZATION_PROMPT,
  EXTRACTION_PATTERN_PROMPT,
} from "./prompts";

export interface WorkflowAnalysis {
  goal: string;
  steps: Array<{
    order: number;
    action: string;
    target: string;
    selector: string;
    value?: string;
    purpose: string;
  }>;
  patterns: string[];
  extractableFields: Array<{
    name: string;
    selector: string;
    type: string;
    description: string;
  }>;
  suggestions: string[];
  estimatedComplexity: "low" | "medium" | "high";
  estimatedDuration: number;
}

export interface OptimizationResult {
  redundantSteps: number[];
  optimizationSuggestions: Array<{
    stepIndex: number;
    suggestion: string;
    reason: string;
  }>;
  estimatedTimeSaved: number;
  riskAssessment: "low" | "medium" | "high";
}

export interface ExtractionPattern {
  tables: Array<{
    selector: string;
    columns: string[];
    rowCount: number;
  }>;
  lists: Array<{
    selector: string;
    itemSelector: string;
    itemCount: number;
  }>;
  cards: Array<{
    containerSelector: string;
    fields: Record<string, string>;
  }>;
}

class AIAnalyzer {
  async isAvailable(): Promise<boolean> {
    const available = await ollamaClient.isAvailable();
    if (!available) return false;

    const hasTextModel = await ollamaClient.hasModel("llama3.2");
    return hasTextModel;
  }

  async analyzeWorkflow(
    events: any[],
    pageUrl: string,
    pageTitle: string
  ): Promise<WorkflowAnalysis> {
    if (!(await this.isAvailable())) {
      throw new Error(
        "AI analysis unavailable: Ollama not running or llama3.2 not installed"
      );
    }

    const prompt = ANALYSIS_USER_PROMPT(events, pageUrl, pageTitle);

    const response = await ollamaClient.chat({
      model: "llama3.2",
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      options: {
        temperature: 0.3,
        num_predict: 2048,
      },
    });

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in AI response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        goal: parsed.goal || "Unknown goal",
        steps: parsed.steps || [],
        patterns: parsed.patterns || [],
        extractableFields: parsed.extractableFields || [],
        suggestions: parsed.suggestions || [],
        estimatedComplexity: parsed.estimatedComplexity || "medium",
        estimatedDuration: parsed.estimatedDuration || 30,
      };
    } catch (error) {
      console.error("Failed to parse AI response:", error);
      throw new Error("Failed to parse AI analysis response");
    }
  }

  async optimizeWorkflow(workflow: any): Promise<OptimizationResult> {
    if (!(await this.isAvailable())) {
      throw new Error("AI optimization unavailable");
    }

    const prompt = WORKFLOW_OPTIMIZATION_PROMPT(workflow);

    const response = await ollamaClient.chat({
      model: "llama3.2",
      messages: [
        {
          role: "system",
          content:
            "You are a workflow optimization assistant. Analyze workflows and suggest improvements.",
        },
        { role: "user", content: prompt },
      ],
      options: {
        temperature: 0.3,
        num_predict: 1024,
      },
    });

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in AI response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        redundantSteps: parsed.redundantSteps || [],
        optimizationSuggestions: parsed.optimizationSuggestions || [],
        estimatedTimeSaved: parsed.estimatedTimeSaved || 0,
        riskAssessment: parsed.riskAssessment || "medium",
      };
    } catch (error) {
      console.error("Failed to parse optimization response:", error);
      throw new Error("Failed to parse AI optimization response");
    }
  }

  async detectExtractionPatterns(pageHtml: string): Promise<ExtractionPattern> {
    if (!(await this.isAvailable())) {
      throw new Error("AI pattern detection unavailable");
    }

    const prompt = EXTRACTION_PATTERN_PROMPT(pageHtml);

    const response = await ollamaClient.chat({
      model: "llama3.2",
      messages: [
        {
          role: "system",
          content:
            "You are a data extraction specialist. Analyze HTML and identify extractable data patterns.",
        },
        { role: "user", content: prompt },
      ],
      options: {
        temperature: 0.3,
        num_predict: 1024,
      },
    });

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in AI response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        tables: parsed.tables || [],
        lists: parsed.lists || [],
        cards: parsed.cards || [],
      };
    } catch (error) {
      console.error("Failed to parse pattern response:", error);
      throw new Error("Failed to parse AI pattern response");
    }
  }
}

export const aiAnalyzer = new AIAnalyzer();
