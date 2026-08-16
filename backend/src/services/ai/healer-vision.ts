import { Page } from "playwright";
import { ollamaClient } from "./ollama-client";
import { HEALING_VISION_PROMPT, HEALING_AGENT_PROMPT } from "./prompts";

export interface HealingResult {
  success: boolean;
  method: "vision" | "agent" | "failed";
  selector?: string;
  confidence?: number;
  reasoning?: string;
  coordinates?: { x: number; y: number };
}

export interface AgentAction {
  action: "CLICK" | "INPUT" | "SCROLL" | "WAIT" | "NAVIGATE";
  selector?: string;
  value?: string;
  reasoning: string;
  confidence: number;
}

class AIHealerVision {
  private visionModel = "llava";
  private agentModel = "llama3.2";

  async isAvailable(): Promise<boolean> {
    const available = await ollamaClient.isAvailable();
    if (!available) return false;

    const hasVision = await ollamaClient.hasModel(this.visionModel);
    const hasAgent = await ollamaClient.hasModel(this.agentModel);
    return hasVision && hasAgent;
  }

  private async takeScreenshot(page: Page): Promise<string> {
    const buffer = await page.screenshot({ type: "png" });
    return buffer.toString("base64");
  }

  private async getPageState(page: Page): Promise<string> {
    const elements = await page.evaluate(() => {
      const els = Array.from(
        document.querySelectorAll("button, a, input, select, textarea")
      );
      return els
        .slice(0, 50)
        .map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            text: el.textContent?.trim().substring(0, 50),
            type: el.getAttribute("type"),
            placeholder: el.getAttribute("placeholder"),
            ariaLabel: el.getAttribute("aria-label"),
            testId: el.getAttribute("data-testid"),
            visible: rect.width > 0 && rect.height > 0,
            coordinates: { x: rect.x, y: rect.y },
          };
        })
        .filter((el) => el.visible);
    });
    return JSON.stringify(elements);
  }

  async healWithVision(
    page: Page,
    intent: string,
    context: string,
    failedSelector: string
  ): Promise<HealingResult> {
    if (!(await this.isAvailable())) {
      return { success: false, method: "failed" };
    }

    try {
      const screenshot = await this.takeScreenshot(page);
      const prompt = HEALING_VISION_PROMPT(intent, context, failedSelector);

      const response = await ollamaClient.generateWithVision(
        prompt,
        screenshot,
        this.visionModel
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { success: false, method: "failed" };
      }

      const result = JSON.parse(jsonMatch[0]);

      if (result.found && result.confidence >= 0.6) {
        return {
          success: true,
          method: "vision",
          selector: result.selector,
          confidence: result.confidence,
          reasoning: result.reasoning,
          coordinates: result.coordinates,
        };
      }

      return { success: false, method: "failed" };
    } catch (error) {
      console.error("Vision healing failed:", error);
      return { success: false, method: "failed" };
    }
  }

  async healWithAgent(
    page: Page,
    intent: string,
    context: string,
    maxAttempts: number = 3
  ): Promise<HealingResult> {
    if (!(await this.isAvailable())) {
      return { success: false, method: "failed" };
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const pageState = await this.getPageState(page);
        const prompt = HEALING_AGENT_PROMPT(
          intent,
          context,
          JSON.stringify(pageState, null, 2)
        );

        const response = await ollamaClient.chat({
          model: this.agentModel,
          messages: [
            {
              role: "system",
              content:
                "You are a web automation agent. Analyze the page and suggest actions.",
            },
            { role: "user", content: prompt },
          ],
          options: {
            temperature: 0.3,
            num_predict: 512,
          },
        });

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          continue;
        }

        const action: AgentAction = JSON.parse(jsonMatch[0]);

        if (action.confidence < 0.5) {
          continue;
        }

        if (action.action === "SCROLL") {
          await page.mouse.wheel(0, 400);
          await page.waitForTimeout(1000);
          continue;
        }

        if (action.action === "WAIT") {
          await page.waitForTimeout(2000);
          continue;
        }

        if (action.action === "CLICK" && action.selector) {
          const element = page.locator(action.selector).first();
          const isVisible = await element
            .isVisible({ timeout: 2000 })
            .catch(() => false);

          if (isVisible) {
            return {
              success: true,
              method: "agent",
              selector: action.selector,
              confidence: action.confidence,
              reasoning: action.reasoning,
            };
          }
        }

        if (action.action === "INPUT" && action.selector && action.value) {
          const element = page.locator(action.selector).first();
          const isVisible = await element
            .isVisible({ timeout: 2000 })
            .catch(() => false);

          if (isVisible) {
            return {
              success: true,
              method: "agent",
              selector: action.selector,
              confidence: action.confidence,
              reasoning: action.reasoning,
            };
          }
        }
      } catch (error) {
        console.error(`Agent healing attempt ${attempt + 1} failed:`, error);
      }
    }

    return { success: false, method: "failed" };
  }

  async heal(
    page: Page,
    intent: string,
    context: string,
    failedSelector: string
  ): Promise<HealingResult> {
    const visionResult = await this.healWithVision(
      page,
      intent,
      context,
      failedSelector
    );
    if (visionResult.success) {
      return visionResult;
    }

    const agentResult = await this.healWithAgent(page, intent, context);
    if (agentResult.success) {
      return agentResult;
    }

    return { success: false, method: "failed" };
  }
}

export const aiHealerVision = new AIHealerVision();
