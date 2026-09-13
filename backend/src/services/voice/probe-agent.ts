import { chromium, Browser, Page } from "playwright";
import { prisma } from "../../index";
import { ollamaClient } from "../ai/ollama-client";
import {
  dismissOverlays,
  aiFindElement,
  autoExtractProducts,
  performSearch,
} from "../workflow/executor";
import { calculatePrice } from "../pricing/pricing-engine";
import { extractJson, VoiceIntent } from "./intent-parser";

const PLANNER_MODEL = "qwen3:8b";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface ExtractionField {
  name: string;
  kind: string;
  selector: string;
  samples: string[];
}

interface VerifiedSelector {
  count: number;
  samples: string[];
}

const KIND_SELECTORS: Record<string, string[]> = {
  name: [
    "h6 a, h5 a, h4 a, .name-area-height-fixed a, .name-area a, .product-name, .product-title, .card-title, .name a",
    "h3 a, h4 a, .product-name a, .product-title a",
  ],
  price: ["[class*=price], .price-style, .price-area"],
  link: ["a[href]"],
  url: ["a[href]"],
  image: ["img"],
  img: ["img"],
  rating: ["[class*=rating], [class*=star]"],
  sku: ["[class*=sku], [class*=model], [class*=code]"],
  brand: ["[class*=brand]"],
  description: ["[class*=desc], [class*=summary]"],
};

const CARD_SELECTOR_CANDIDATES = [
  ".single-prodcut",
  ".single-product",
  ".product-item",
  ".product-card",
  ".product-thumb",
  "[class*=product-list] > div",
  "[class*=product-grid] > div",
  "[class*=product-grid] li",
  ".card",
];

async function appendLog(jobId: string, stage: string, message: string): Promise<void> {
  try {
    const job = await prisma.voiceJob.findUnique({ where: { id: jobId } });
    const logs: any[] = Array.isArray(job?.logs) ? (job.logs as any[]) : [];
    logs.push({ at: new Date().toISOString(), stage, message });
    await prisma.voiceJob.update({
      where: { id: jobId },
      data: { logs: logs as any, stage },
    });
  } catch {
    // logging must never break the probe
  }
}

async function failJob(jobId: string, error: string): Promise<void> {
  await appendLog(jobId, "failed", error);
  await prisma.voiceJob.update({
    where: { id: jobId },
    data: { status: "FAILED", stage: "failed", error },
  });
}

async function resolvePlannerModel(): Promise<string | null> {
  if (await ollamaClient.hasModel(PLANNER_MODEL)) return PLANNER_MODEL;
  if (await ollamaClient.hasModel("llama3.2")) return "llama3.2";
  return null;
}

async function waitForSettle(page: Page): Promise<void> {
  try {
    await page.waitForLoadState("networkidle", { timeout: 15000 });
  } catch {
    try {
      await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
    } catch {}
  }
  try {
    await page.waitForFunction(() => document.readyState === "complete", {
      timeout: 10000,
    });
  } catch {}
  await page.waitForTimeout(5000);
  await dismissOverlays(page);
}

async function findSearchInput(page: Page, planner: string): Promise<string | null> {
  const commonSelectors = [
    'input[type="search"]',
    'input[name*="search" i]',
    'input[id*="search" i]',
    'input[placeholder*="search" i]',
    'input[aria-label*="search" i]',
    'form[role="search"] input',
    '[class*="search"] input',
  ];

  for (const sel of commonSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) return sel;
    } catch {}
  }

  // Hidden-but-present search inputs (mobile navs, focus-reveal boxes):
  // if exactly one element matches a clear search signal, use it.
  const hiddenSearchSignals = [
    'input[type="search"]',
    'input[name="q"]',
    'input[id*="search" i]',
    'input[aria-label*="search" i]',
    'input[placeholder*="search" i]',
  ];
  for (const sel of hiddenSearchSignals) {
    const count = await page.locator(sel).count().catch(() => 0);
    if (count === 1) return sel;
  }

  const aiResult = await aiFindElement(page, "INPUT", "search box", "", planner);
  if (aiResult?.selector) {
    try {
      const el = page.locator(aiResult.selector).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) return aiResult.selector;
    } catch {}
  }

  // Last resort: only if there is exactly one visible text input on the page
  try {
    const visible = await page
      .locator('input[type="text"], input:not([type])')
      .evaluateAll((els) =>
        els.filter((el) => {
          const r = (el as HTMLElement).getBoundingClientRect();
          const st = window.getComputedStyle(el);
          return r.width > 40 && st.display !== "none" && st.visibility !== "hidden";
        }).length
      );
    if (visible === 1) return 'input[type="text"], input:not([type])';
  } catch {}

  return null;
}

async function findCardSelector(page: Page): Promise<string | null> {
  for (const sel of CARD_SELECTOR_CANDIDATES) {
    try {
      const count = await page.locator(sel).count();
      if (count > 0) return sel;
    } catch {}
  }
  return null;
}

function candidateSelectorsFor(cardSelector: string | null, kind: string): string[] {
  const subs = KIND_SELECTORS[kind] || KIND_SELECTORS.name;
  const selectors: string[] = [];
  for (const sub of subs) {
    if (cardSelector) selectors.push(`${cardSelector} ${sub}`);
    selectors.push(sub);
  }
  return selectors;
}

async function verifySelector(page: Page, selector: string, kind: string): Promise<VerifiedSelector> {
  try {
    if (kind === "image" || kind === "img") {
      const count = await page.locator(selector).count();
      return { count, samples: [] };
    }
    const texts = await page.locator(selector).allTextContents();
    const clean = texts
      .map((t) => t.trim().replace(/\s+/g, " "))
      .filter((t) => t && t.length > 1 && t.length < 300);
    return { count: clean.length, samples: clean };
  } catch {
    return { count: 0, samples: [] };
  }
}

const BOILERPLATE = new Set([
  "home", "search", "login", "sign up", "register", "about", "contact",
  "blog", "latest blog posts", "blog posts", "categories", "menu", "cart",
  "account", "log in", "log out", "subscribe", "newsletter", "help",
]);

function matchesKind(kind: string, samples: string[]): boolean {
  const distinct = new Set(samples.map((s) => s.toLowerCase().trim()));
  if (distinct.size < 2) return false;
  if (kind === "image" || kind === "img") return true;
  if (kind === "price") return samples.some((s) => /\d/.test(s));
  const avgLen = samples.reduce((a, s) => a + s.length, 0) / samples.length;
  const allBoilerplate = samples.every((s) => BOILERPLATE.has(s.toLowerCase().trim()));
  return avgLen > 3 && !allBoilerplate;
}

async function getExtractionDomSample(page: Page): Promise<string> {
  return page.evaluate(() => {
    const lines: string[] = [];
    const seen = new Set<string>();
    const candidates = document.querySelectorAll(
      '.single-prodcut, .single-product, [class*="product"], [class*="item"], [class*="card"], [class*="price"], [class*="name"], article'
    );
    let count = 0;
    candidates.forEach((el) => {
      if (count >= 60) return;
      const cls =
        el.className && typeof el.className === "string"
          ? el.className
              .trim()
              .split(/\s+/)
              .filter((c) => c.length < 30 && !/^[a-f0-9]{6,}$/i.test(c))
              .slice(0, 4)
              .join(".")
          : "";
      const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80);
      const key = `${el.tagName.toLowerCase()}.${cls}::${text}`;
      if (seen.has(key) || (!cls && !text)) return;
      seen.add(key);
      lines.push(`${el.tagName.toLowerCase()}.${cls} :: "${text}"`);
      count++;
    });
    return lines.join("\n");
  });
}

async function aiPickFieldSelector(
  page: Page,
  fieldName: string,
  kind: string,
  planner: string,
  autoExtract: Record<string, any[]>,
  usedSelectors: string[] = []
): Promise<string | null> {
  try {
    const sample = await getExtractionDomSample(page);
    const known: Record<string, string[]> = {};
    if (autoExtract.products) known.products = autoExtract.products.slice(0, 3);
    if (autoExtract.prices) known.prices = autoExtract.prices.slice(0, 3);

    const prompt = `You are a web scraping assistant. A search results page is open in a browser. I need a CSS selector that matches ALL elements containing the "${kind}" data for the field "${fieldName}".

The extractor already scraped these sample values from the page:
${JSON.stringify(known)}

Sample DOM elements from the page:
${sample.slice(0, 3000)}

Reply with ONLY a JSON object:
{"selector": "one-css-selector-or-comma-list-that-matches-ALL-such-elements", "confidence": 0.0-1.0}

Rules:
- The selector must match every element of this type (e.g. all product names), not just one.
- Prefer stable class names over nth-child or inline styles.
- For product names prefer anchors/headings inside product cards.
- For prices prefer elements whose class contains "price".
- For authors prefer elements whose class contains "author".
- If impossible, return {"selector": "", "confidence": 0}.`;

    const usedHint =
      usedSelectors.length > 0
        ? `\nIMPORTANT: These selectors were already chosen for OTHER fields. Pick something different for "${fieldName}": ${usedSelectors.join(", ")}`
        : "";

    const response = await ollamaClient.chat({
      model: planner,
      messages: [{ role: "user", content: prompt + usedHint }],
      options: { temperature: 0.1, num_predict: 200 },
    });

    const json = extractJson(response);
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (parsed.selector && parsed.confidence > 0.4) return String(parsed.selector);
    return null;
  } catch {
    return null;
  }
}

async function discoverExtractionSelectors(
  page: Page,
  intent: VoiceIntent,
  planner: string
): Promise<ExtractionField[]> {
  const targets = intent.extractionTargets?.length
    ? intent.extractionTargets
    : [
        { name: "products", kind: "name" },
        { name: "prices", kind: "price" },
      ];

  const cardSelector = await findCardSelector(page);
  const autoExtract = await autoExtractProducts(page);
  const fields: ExtractionField[] = [];
  const chosenFields: { selector: string; samples: string[] }[] = [];

  const isDuplicate = (sel: string, samples: string[]) =>
    chosenFields.some((c) => c.selector === sel) ||
    chosenFields.some((c) => {
      if (!samples.length || !c.samples.length) return false;
      const overlap = samples.filter((s) => c.samples.includes(s)).length;
      return overlap / samples.length >= 0.6;
    });

  for (const target of targets) {
    const kind = String(target.kind || "name").toLowerCase();
    const selectors = candidateSelectorsFor(cardSelector, kind);
    let chosen: { selector: string; samples: string[] } | null = null;

    for (const sel of selectors) {
      const verified = await verifySelector(page, sel, kind);
      if (verified.count >= 2 && matchesKind(kind, verified.samples) && !isDuplicate(sel, verified.samples)) {
        chosen = { selector: sel, samples: verified.samples };
        break;
      }
    }

    if (!chosen) {
      const aiSel = await aiPickFieldSelector(
        page,
        target.name,
        kind,
        planner,
        autoExtract,
        chosenFields.map((c) => c.selector)
      );
      if (aiSel) {
        const verified = await verifySelector(page, aiSel, kind);
        if (verified.count >= 2 && matchesKind(kind, verified.samples) && !isDuplicate(aiSel, verified.samples)) {
          chosen = { selector: aiSel, samples: verified.samples };
        }
      }
    }

    if (chosen) {
      fields.push({
        name: target.name,
        kind,
        selector: chosen.selector,
        samples: chosen.samples.slice(0, 5),
      });
      chosenFields.push({ selector: chosen.selector, samples: chosen.samples });
    }
  }

  return fields;
}

async function saveWorkflowAndApi(
  userId: string,
  intent: VoiceIntent,
  searchSelector: string,
  example: string,
  fields: ExtractionField[],
  totalResults: number
): Promise<{ workflowId: string; apiId: string; sample: any }> {
  const hostname = new URL(intent.targetUrl).hostname;
  const variable = intent.variables[0];

  const steps: any[] = [
    {
      stepOrder: 1,
      actionType: "NAVIGATE",
      selector: "url",
      value: intent.targetUrl,
      url: intent.targetUrl,
      context: `Navigate to ${hostname}`,
    },
    {
      stepOrder: 2,
      actionType: "INPUT",
      selector: searchSelector,
      value: example,
      context: `Search ${hostname} for products`,
      isConstant: !variable,
    },
  ];

  for (let i = 0; i < fields.length; i++) {
    steps.push({
      stepOrder: i + 3,
      actionType: "CLICK",
      selector: fields[i].selector,
      context: `${fields[i].name} extraction`,
      isExtractionTarget: true,
      isConstant: true,
      fieldName: fields[i].name,
    });
  }

  const workflow = await prisma.workflow.create({
    data: {
      userId,
      name: intent.apiName,
      steps: { create: steps },
    },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

  if (variable) {
    const inputStep = workflow.steps.find((s) => s.actionType === "INPUT");
    if (inputStep) {
      await prisma.workflowVariable.create({
        data: {
          workflowId: workflow.id,
          stepId: inputStep.id,
          variableName: variable.name,
          defaultValue: example,
          required: true,
        },
      });
    }
  }

  const price = await calculatePrice(workflow.steps.length);
  const api = await prisma.api.create({
    data: {
      userId,
      apiName: intent.apiName,
      description: intent.description,
      workflowId: workflow.id,
      complexityLevel: workflow.steps.length,
      pricePerCall: price,
    },
  });

  const sample: Record<string, any> = { totalResults };
  for (const f of fields) {
    sample[f.name] = { count: f.samples.length, sample: f.samples.slice(0, 3) };
  }

  return { workflowId: workflow.id, apiId: api.id, sample };
}

export async function runVoiceProbe(jobId: string, userId: string, intent: VoiceIntent): Promise<void> {
  let browser: Browser | null = null;
  try {
    await appendLog(jobId, "checking", "Checking AI planner (qwen3:8b)");
    const planner = await resolvePlannerModel();
    if (!planner) {
      await failJob(jobId, `The planning model is not installed. Run: ollama pull qwen3:8b`);
      return;
    }

    await prisma.voiceJob.update({ where: { id: jobId }, data: { status: "RUNNING" } });

    await appendLog(jobId, "browsing", `Opening ${intent.targetUrl}`);
    browser = await chromium.launch({ headless: false, slowMo: 250 });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: USER_AGENT,
    });
    const page = await context.newPage();
    context.on("page", (newPage) => {
      newPage.close().catch(() => {});
    });

    try {
      await page.goto(intent.targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    } catch {
      await page.goto(intent.targetUrl, { waitUntil: "load", timeout: 45000 });
    }
    await page.waitForTimeout(4000);
    await dismissOverlays(page);

    await appendLog(jobId, "search-input", "Looking for the search box");
    const searchSelector = await findSearchInput(page, planner);
    if (!searchSelector) {
      throw new Error(`Could not find a search box on ${intent.targetUrl}. The site may require login or have an unusual layout.`);
    }

    const variable = intent.variables[0];
    const example = variable?.example || "test";

    await performSearch(page, searchSelector, example);

    await appendLog(jobId, "searching", `Searching for "${example}"`);
    await waitForSettle(page);

    await appendLog(jobId, "extracting", "Extracting sample results");
    const fields = await discoverExtractionSelectors(page, intent, planner);
    if (fields.length === 0) {
      throw new Error(
        `No data could be extracted from the results page for "${example}". The site may block automation or require login.`
      );
    }

    const totalResults = Math.max(...fields.map((f) => f.samples.length), 0);
    await appendLog(jobId, "verified", `Verified ${totalResults} result(s): ${fields.map((f) => `${f.name} (${f.samples.length})`).join(", ")}`);

    await appendLog(jobId, "saving", "Saving workflow and creating API");
    const result = await saveWorkflowAndApi(userId, intent, searchSelector, example, fields, totalResults);

    await prisma.voiceJob.update({
      where: { id: jobId },
      data: {
        status: "SUCCEEDED",
        stage: "done",
        workflowId: result.workflowId,
        apiId: result.apiId,
        sampleJson: result.sample,
      },
    });
    await appendLog(jobId, "done", "API created successfully");
  } catch (err: any) {
    await failJob(jobId, err?.message || "Unknown error");
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
