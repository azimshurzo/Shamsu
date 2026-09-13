import { chromium, Browser, Page, Locator } from "playwright";
import { ollamaClient } from "../ai/ollama-client";

interface StepData {
  id: string;
  actionType: string;
  selector: string;
  value?: string | null;
  url?: string | null;
  context?: string | null;
  text?: string | null;
  isExtractionTarget?: boolean;
  containerSelector?: string | null;
  fieldSelector?: string | null;
  fieldName?: string | null;
}

interface VariableDef {
  id?: string;
  stepId?: string | null;
  variableName: string;
  defaultValue?: string | null;
}

export async function dismissOverlays(page: Page): Promise<void> {
  const dismissSelectors = [
    '[data-testid="modal-close"]',
    '[aria-label="Dismiss sign-in info."]',
    '[aria-label="Dismiss."]',
    'button[aria-label="Close"]',
    '[role="dialog"] button[class*="close"]',
    '[class*="cookie"] button',
    '[id*="cookie"] button',
    'button:has-text("Accept")',
    'button:has-text("Got it")',
    'button:has-text("Close")',
    'button:has-text("Continue")',
  ];

  for (const sel of dismissSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 300 }).catch(() => false)) {
        await el.click({ timeout: 800 }).catch(() => {});
        await page.waitForTimeout(300);
      }
    } catch {}
  }

  await page.evaluate(`
    const sels = [
      '[data-testid*="modal"]','[data-testid*="overlay"]',
      '[class*="modal"]','[class*="overlay"]','[class*="popup"]',
      '[role="dialog"]','[class*="cookie"]','[class*="consent"]',
      '[id*="modal"]','[id*="overlay"]','[id*="cookie"]',
    ];
    for (const s of sels) {
      document.querySelectorAll(s).forEach((el) => {
        const st = window.getComputedStyle(el);
        if (st.position === "fixed" || st.position === "absolute") el.remove();
      });
    }
  `);
  await page.waitForTimeout(300);
}

async function safeClick(locator: Locator): Promise<void> {
  try {
    await locator.click({ timeout: 5000 });
  } catch (err: any) {
    const msg = err.message || "";
    if (msg.includes("intercept") || msg.includes("pointer")) {
      await locator.click({ force: true, timeout: 5000 });
    } else {
      throw err;
    }
  }
}

export async function performSearch(page: Page, searchSelector: string, example: string): Promise<void> {
  const searchInput = page.locator(searchSelector).first();
  await searchInput.scrollIntoViewIfNeeded().catch(() => {});
  const trySubmit = async () => {
    try {
      await searchInput.click({ timeout: 5000 });
      await searchInput.fill("");
      await searchInput.type(example, { delay: 60 });
    } catch {
      // Hidden / focus-reveal search input: focus via JS and type with the keyboard.
      await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLInputElement | null;
        if (el) el.focus();
      }, searchSelector);
      await page.waitForTimeout(200);
      await page.keyboard.type(example, { delay: 60 });
    }
    await page.waitForTimeout(600);
    await searchInput.press("Enter").catch(() => page.keyboard.press("Enter"));
  };

  const startUrl = page.url();
  await trySubmit();

  const changed = await page
    .waitForFunction(
      (base) => window.location.href.split("?")[0] !== base.split("?")[0],
      startUrl,
      { timeout: 10000 }
    )
    .then(() => true, () => false);

  if (!changed) {
    await trySubmit();
    await page
      .waitForFunction(
        (base) => window.location.href.split("?")[0] !== base.split("?")[0],
        startUrl,
        { timeout: 8000 }
      )
      .then(() => {}, () => {});
  }

  // Last resort: many sites use a /search?q= endpoint.
  if (page.url().split("?")[0] === startUrl.split("?")[0]) {
    const u = new URL(startUrl);
    await page
      .goto(`${u.origin}/search?q=${encodeURIComponent(example)}`, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      })
      .catch(() => {});
    await page.waitForTimeout(3000);
  }
}

export async function getPageDomSummary(page: Page): Promise<string> {
  return page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input, textarea, select"));
    const buttons = Array.from(document.querySelectorAll("button, a[role='button'], input[type='submit']"));
    const links = Array.from(document.querySelectorAll("a[href]"));

    const summary: string[] = [];

    summary.push("=== INPUTS ===");
    inputs.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const attrs = [
        el.id ? `id="${el.id}"` : "",
        el.getAttribute("name") ? `name="${el.getAttribute("name")}"` : "",
        el.getAttribute("placeholder") ? `placeholder="${el.getAttribute("placeholder")}"` : "",
        el.getAttribute("type") ? `type="${el.getAttribute("type")}"` : "",
        el.className ? `class="${(el.className as string).substring(0, 60)}"` : "",
      ].filter(Boolean).join(" ");
      summary.push(`  <${el.tagName.toLowerCase()} ${attrs}>`);
    });

    summary.push("\n=== BUTTONS ===");
    buttons.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const text = el.textContent?.trim().substring(0, 50) || "";
      const attrs = [
        el.id ? `id="${el.id}"` : "",
        el.className ? `class="${(el.className as string).substring(0, 60)}"` : "",
      ].filter(Boolean).join(" ");
      summary.push(`  <${el.tagName.toLowerCase()} ${attrs}> "${text}"`);
    });

    summary.push("\n=== SEARCH-LIKE ELEMENTS ===");
    const searchEls = document.querySelectorAll(
      'input[type="search"], input[name*="search"], input[id*="search"], input[placeholder*="search" i], input[placeholder*="Search" i], a[href*="search"], button[aria-label*="search" i]'
    );
    searchEls.forEach((el) => {
      const attrs = [
        el.id ? `id="${el.id}"` : "",
        el.getAttribute("name") ? `name="${el.getAttribute("name")}"` : "",
        el.getAttribute("placeholder") ? `placeholder="${el.getAttribute("placeholder")}"` : "",
      ].filter(Boolean).join(" ");
      summary.push(`  FOUND: <${el.tagName.toLowerCase()} ${attrs}>`);
    });

    return summary.join("\n");
  });
}

export async function aiFindElement(
  page: Page,
  actionType: string,
  context: string,
  value: string,
  model: string = "llama3.2"
): Promise<{ selector: string; confidence: number } | null> {
  try {
    const available = await ollamaClient.isAvailable();
    const hasModel = await ollamaClient.hasModel(model);
    if (!available || !hasModel) return null;

    const domSummary = await getPageDomSummary(page);
    const pageTitle = await page.title();
    const pageUrl = page.url();

    const prompt = `You are a web automation assistant. Given the current page state, find the best CSS selector for the requested action.

PAGE: ${pageTitle}
URL: ${pageUrl}

ACTION: ${actionType}
INTENT: ${context}
${value ? `VALUE TO INPUT: ${value}` : ""}

CURRENT DOM:
${domSummary}

Respond with ONLY a JSON object:
{"selector": "css-selector", "confidence": 0.0-1.0, "reason": "brief reason"}

Rules:
- For INPUT actions: find the input field (search box, text field, etc.)
- For CLICK actions: find the clickable element (button, link, etc.)
- For EXTRACT: find the element containing the data
- Use specific selectors: id > name > aria-label > text content > class
- If you cannot find it, return {"selector": "", "confidence": 0}
- For search inputs, prefer inputs with name="search", id containing "search", or placeholder containing "search"`;

    const response = await ollamaClient.chat({
      model,
      messages: [{ role: "user", content: prompt }],
      options: { temperature: 0.1, num_predict: 256 },
    });

    const jsonMatch = response.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      if (result.selector && result.confidence > 0.5) {
        console.log(`AI found selector: ${result.selector} (confidence: ${result.confidence})`);
        return result;
      }
    }
  } catch (err) {
    console.log(`AI find failed: ${err}`);
  }
  return null;
}

async function findElement(page: Page, step: StepData): Promise<Locator | null> {
  const searchText = step.text || step.context;

  // L0: Exact CSS selector
  try {
    const byCss = page.locator(step.selector).first();
    if (await byCss.isVisible({ timeout: 2000 }).catch(() => false)) return byCss;
  } catch {}

  // L1: Attribute extraction from selector
  const testIdMatch = step.selector.match(/\[data-testid="([^"]+)"\]/);
  if (testIdMatch) {
    try {
      const el = page.locator(`[data-testid="${testIdMatch[1]}"]`).first();
      if (await el.isVisible({ timeout: 1500 }).catch(() => false)) return el;
    } catch {}
  }

  const ariaMatch = step.selector.match(/\[aria-label="([^"]+)"\]/);
  if (ariaMatch) {
    try {
      const el = page.locator(`[aria-label="${ariaMatch[1]}"]`).first();
      if (await el.isVisible({ timeout: 1500 }).catch(() => false)) return el;
    } catch {}
  }

  const phMatch = step.selector.match(/\[placeholder="([^"]+)"\]/);
  if (phMatch) {
    try {
      const el = page.locator(`[placeholder="${phMatch[1]}"]`).first();
      if (await el.isVisible({ timeout: 1500 }).catch(() => false)) return el;
    } catch {}
  }

  // L1b: Text-based finding
  if (searchText && searchText.length > 1 && searchText.length < 80) {
    try {
      const el = page.getByText(searchText, { exact: false }).first();
      if (await el.isVisible({ timeout: 1500 }).catch(() => false)) return el;
    } catch {}

    for (const role of ["button", "link", "tab", "option", "menuitem"] as const) {
      try {
        const el = page.getByRole(role, { name: searchText }).first();
        if (await el.isVisible({ timeout: 1000 }).catch(() => false)) return el;
      } catch {}
    }

    try {
      const el = page.getByPlaceholder(searchText, { exact: false }).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) return el;
    } catch {}

    try {
      const el = page.getByLabel(searchText, { exact: false }).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) return el;
    } catch {}
  }

  // L1c: ID-based extraction from selector
  const idMatch = step.selector.match(/#([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    try {
      const el = page.locator(`#${idMatch[1]}`).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) return el;
    } catch {}
  }

  // L1d: Class-based partial matching
  const classMatch = step.selector.match(/\.([a-zA-Z0-9_-]+)/);
  if (classMatch) {
    try {
      const el = page.locator(`.${classMatch[1]}`).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) return el;
    } catch {}
  }

  // L2: Dismiss overlays and retry
  await dismissOverlays(page);
  if (searchText && searchText.length > 1 && searchText.length < 80) {
    try {
      const el = page.getByText(searchText, { exact: false }).first();
      if (await el.isVisible({ timeout: 1500 }).catch(() => false)) return el;
    } catch {}
  }

  // L3: AI Vision - Use Ollama to analyze screenshot and find element
  try {
    const available = await ollamaClient.isAvailable();
    const hasVision = await ollamaClient.hasModel("llava");
    if (available && hasVision) {
      const screenshot = await page.screenshot({ type: "png" });
      const imageBase64 = screenshot.toString("base64");

      const intent = step.context || searchText || step.actionType;
      const prompt = `Look at this screenshot of a web page. I need to ${step.actionType} on: "${intent}".

Find the element I should ${step.actionType.toLowerCase()}.
Return ONLY a JSON object: {"selector": "best-css-selector", "confidence": 0.0-1.0}

Use specific selectors based on what you see: id, name, aria-label, placeholder, visible text, or structural position.
If the element has text "${searchText || ""}", include that in your selector.
If you cannot find it, return {"selector": "", "confidence": 0}`;

      const response = await ollamaClient.generate({
        model: "llava",
        prompt,
        images: [imageBase64],
        options: { temperature: 0.1, num_predict: 256 },
      });

      const jsonMatch = response.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        if (result.selector && result.confidence > 0.5) {
          try {
            const el = page.locator(result.selector).first();
            if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
              console.log(`AI Vision found: ${result.selector}`);
              return el;
            }
          } catch {}
        }
      }
    }
  } catch (err) {
    console.log(`AI Vision failed: ${err}`);
  }

  // L4: AI DOM Analysis - Use Ollama to analyze DOM and find element
  const aiResult = await aiFindElement(
    page,
    step.actionType,
    step.context || searchText || "",
    step.value || ""
  );
  if (aiResult) {
    try {
      const el = page.locator(aiResult.selector).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        return el;
      }
    } catch {}
  }

  return null;
}

export async function executeWorkflow(
  steps: StepData[],
  userVariables: Record<string, string>,
  variableDefs: VariableDef[]
): Promise<any> {
  const browser: Browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  let page: Page = await context.newPage();
  const originalPage = page;

  context.on("page", (newPage) => {
    newPage.close().catch(() => {});
  });

  const variableMap = new Map<string, string>();
  for (const v of variableDefs) {
    if (v.stepId) variableMap.set(v.stepId, v.variableName);
  }

  const extractionResults: Record<string, any[]> = {};

  try {
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
      const step = steps[stepIndex];
      const varName = variableMap.get(step.id);
      let value = varName
        ? userVariables[varName] || step.value || ""
        : step.value || "";

      await dismissOverlays(page);

      if (page !== originalPage && !page.isClosed()) {
        page = originalPage;
      }

      console.log(`Step ${stepIndex + 1}/${steps.length}: ${step.actionType} - ${step.context || step.selector}`);

      switch (step.actionType) {
        case "NAVIGATE": {
          const url = value || step.url || "";
          console.log(`Navigating to: ${url}`);
          
          // Try networkidle first, fallback to domcontentloaded, then load
          try {
            await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
          } catch {
            try {
              await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
            } catch {
              await page.goto(url, { waitUntil: "load", timeout: 30000 });
            }
          }
          
          // Wait for page to stabilize - check if document is ready
          await page.waitForFunction(() => document.readyState === "complete", { timeout: 15000 }).catch(() => {});
          
          // Extra wait for dynamic sites (React, Vue, etc.)
          await page.waitForTimeout(5000);
          
          // Wait for any loading spinners to disappear
          await page.waitForFunction(() => {
            const spinners = document.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="preloader"]');
            return Array.from(spinners).every(el => {
              const style = window.getComputedStyle(el);
              return style.display === "none" || style.visibility === "hidden" || style.opacity === "0";
            });
          }, { timeout: 5000 }).catch(() => {});
          
          await dismissOverlays(page);
          console.log(`Page loaded: ${await page.title()}`);
          break;
        }

        case "INPUT": {
          // Wait for input to be ready
          await page.waitForTimeout(1000);
          
          let el = await findElement(page, step);
          if (!el) {
            // Hidden-but-present inputs (focus-reveal boxes, mobile navs)
            const hiddenSignals = [
              'input[type="search"]',
              'input[name="q"]',
              'input[id*="search" i]',
              'input[aria-label*="search" i]',
              'input[placeholder*="search" i]',
            ];
            for (const sel of hiddenSignals) {
              const count = await page.locator(sel).count().catch(() => 0);
              if (count > 0) {
                el = page.locator(sel).first();
                break;
              }
            }
          }
          if (!el) {
            console.log("Primary selector failed, trying AI DOM analysis...");
            const aiResult = await aiFindElement(page, "INPUT", step.context || "", value);
            if (aiResult) {
              el = page.locator(aiResult.selector).first();
            }
          }
          if (!el) {
            throw new Error(`Could not find input field: ${step.context || step.selector}`);
          }

          const isSearch = step.context?.toLowerCase().includes("search") || step.selector?.toLowerCase().includes("search");

          if (isSearch) {
            await performSearch(page, step.selector, value || "");
            break;
          }
          
          // Scroll element into view
          await el.scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(500);
          
          try {
            // Click to focus, then clear and type
            await el.click({ timeout: 5000 });
            await page.waitForTimeout(300);
            await el.fill("");
            await page.waitForTimeout(200);
            await el.type(value || "", { delay: 80 });
          } catch {
            // Hidden input: focus via JS and type with the keyboard
            await page
              .evaluate((sel) => {
                const input = document.querySelector(sel) as HTMLInputElement | null;
                if (input) input.focus();
              }, step.selector)
              .catch(() => {});
            await page.waitForTimeout(200);
            await page.keyboard.type(value || "", { delay: 80 });
          }
          
          // Wait for autocomplete/suggestions to appear
          await page.waitForTimeout(2000);
          break;
        }

        case "CLICK": {
          if (step.isExtractionTarget) {
            const name = step.fieldName || step.context || "data";
            try {
              const texts = await page.locator(step.selector).allTextContents();
              extractionResults[name] = texts.filter((t) => t.trim()).map((t) => t.trim());
            } catch {
              extractionResults[name] = [];
            }
            break;
          }
          
          // Wait for element to be ready
          await page.waitForTimeout(500);
          
          let el = await findElement(page, step);
          if (!el) {
            console.log("Primary selector failed, trying AI DOM analysis...");
            const aiResult = await aiFindElement(page, "CLICK", step.context || step.text || "", "");
            if (aiResult) {
              el = page.locator(aiResult.selector).first();
            }
          }
          if (!el) {
            throw new Error(`Could not find element to click: ${step.context || step.selector}`);
          }
          
          // Scroll into view first
          await el.scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(300);
          
          await safeClick(el);
          
          // Wait for page to respond (navigation, modal, etc.)
          await page.waitForTimeout(3000);
          
          // Check if page navigated
          try {
            await page.waitForLoadState("domcontentloaded", { timeout: 5000 });
          } catch {}
          
          await dismissOverlays(page);
          break;
        }

        case "SELECT": {
          let el = await findElement(page, step);
          if (!el) {
            throw new Error(`Could not find select: ${step.context || step.selector}`);
          }
          await el.selectOption(value || "");
          break;
        }

        case "SCROLL":
          await page.mouse.wheel(0, 800);
          await page.waitForTimeout(500);
          break;

        case "WAIT":
          await page.waitForTimeout(parseInt(value || "0") || 2000);
          break;
      }
    }

    // If no extraction targets were defined, try to extract all visible product data
    if (Object.keys(extractionResults).length === 0) {
      console.log("No extraction targets defined, attempting auto-extraction...");
      const extracted = await autoExtractProducts(page);
      if (Object.keys(extracted).length > 0) {
        Object.assign(extractionResults, extracted);
      }
    }

    // If still no data, try to find a relevant page message (no results, error, etc.)
    if (Object.keys(extractionResults).length === 0 || (extractionResults.message && extractionResults.message.length === 0)) {
      console.log("No data extracted, looking for page status message...");
      const pageTitle = await page.title();
      const messages = await extractPageMessages(page);
      console.log(`Found ${messages.length} candidate messages`);

      if (messages.length > 0) {
        let bestMessage = null;

        // Quick heuristic: find messages with "no result", "not found", "error", etc.
        const noResultPatterns = /no\s*(product|result|item|match|data|record)|not\s*found|empty|error|unable|failed|does\s*not\s*exist|cannot|sorry/i;
        bestMessage = messages.find(m => noResultPatterns.test(m));

        // If no heuristic match, ask AI
        if (!bestMessage) {
          console.log("No heuristic match, asking AI for best message...");
          bestMessage = await aiFindMostRelevantMessage(page, pageTitle, messages);
        }

        if (bestMessage) {
          extractionResults["message"] = [bestMessage];
          console.log(`Best message: "${bestMessage}"`);
        }
      }
    }

    const result =
      Object.keys(extractionResults).length > 0
        ? { totalResults: Math.max(...Object.values(extractionResults).map(a => a.length), 0), data: extractionResults }
        : { message: "Workflow executed successfully", pageUrl: page.url(), pageTitle: await page.title() };

    return result;
  } finally {
    await browser.close();
  }
}

export async function autoExtractProducts(page: Page): Promise<Record<string, any[]>> {
  const results: Record<string, any[]> = {};

  try {
    // Scroll down to trigger lazy loading of products
    await page.evaluate(async () => {
      for (let i = 0; i < 8; i++) {
        window.scrollBy(0, 600);
        await new Promise(r => setTimeout(r, 400));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(2000);

    const data = await page.evaluate(() => {
      const extract: Record<string, any[]> = {};

      // Strategy 1: Walton-style cards (.single-prodcut — note the typo on their site)
      const waltonCards = document.querySelectorAll('.single-prodcut, .single-product');
      if (waltonCards.length > 0) {
        const products: string[] = [];
        const prices: string[] = [];
        const links: string[] = [];
        const images: string[] = [];

        waltonCards.forEach(card => {
          const nameEl = card.querySelector('h6 a, h5 a, h4 a, .name-area-height-fixed a, .name-area a');
          if (nameEl) {
            products.push(nameEl.textContent?.trim() || '');
            links.push((nameEl as HTMLAnchorElement).href);
          }
          const priceEl = card.querySelector('.price-style, .price-area .price, [class*=price]');
          if (priceEl) {
            const text = priceEl.textContent?.trim().split('\n')[0].trim();
            if (text && text !== 'AVAILABLE' && text !== 'CALL FOR PRICING' && text.length > 0) {
              prices.push(text);
            }
          }
          const imgEl = card.querySelector('img') as HTMLImageElement | null;
          if (imgEl?.src) {
            images.push(imgEl.src);
          }
        });

        if (products.length > 0) extract['products'] = products;
        if (prices.length > 0) extract['prices'] = prices;
        if (links.length > 0) extract['links'] = links;
        if (images.length > 0) extract['images'] = images;
        return extract;
      }

      // Strategy 2: Generic product containers
      const genericCards = document.querySelectorAll(
        '.product-item, .product-card, .product-thumb, [class*=product-list] > div, [class*=product-grid] > div'
      );
      if (genericCards.length > 0) {
        const products: string[] = [];
        const prices: string[] = [];
        const links: string[] = [];

        genericCards.forEach(card => {
          const nameEl = card.querySelector('h3, h4, .product-name, .product-title, .card-title');
          if (nameEl) products.push(nameEl.textContent?.trim() || '');
          const priceEl = card.querySelector('.price, .product-price, [class*=price]');
          if (priceEl) prices.push(priceEl.textContent?.trim() || '');
          const linkEl = card.querySelector('a') as HTMLAnchorElement | null;
          if (linkEl?.href) links.push(linkEl.href);
        });

        if (products.length > 0) extract['products'] = products;
        if (prices.length > 0) extract['prices'] = prices;
        if (links.length > 0) extract['links'] = links;
        return extract;
      }

      // Strategy 3: Find price elements and walk up to their product card, then extract names+links
      const priceEls = document.querySelectorAll('.price-style, .price-area, .product-price');
      if (priceEls.length > 0) {
        const seenProducts = new Set<string>();
        const products: string[] = [];
        const prices: string[] = [];
        const links: string[] = [];

        priceEls.forEach(priceEl => {
          const priceText = priceEl.textContent?.trim().split('\n')[0].trim();
          if (!priceText || priceText.length > 30 || priceText === 'AVAILABLE' || priceText === 'CALL FOR PRICING') return;

          // Walk up to find the containing card
          let card = priceEl.parentElement;
          for (let i = 0; i < 5; i++) {
            if (!card) break;
            const nameEl = card.querySelector('h3, h4, h5, h6, .name-area, [class*=name]');
            if (nameEl) {
              const name = nameEl.textContent?.trim() || '';
              if (name && !seenProducts.has(name) && name.length > 2 && name.length < 200) {
                seenProducts.add(name);
                products.push(name);
                prices.push(priceText);
                const linkEl = card.querySelector('a[href]') as HTMLAnchorElement | null;
                if (linkEl) links.push(linkEl.href);
              }
              break;
            }
            card = card.parentElement;
          }
        });

        if (products.length > 0) {
          extract['products'] = products;
          extract['prices'] = prices;
          extract['links'] = links;
          return extract;
        }
      }

      // Strategy 4: Find product links in the main content area (exclude nav/menu)
      const mainContent = document.querySelector('#content, main, [role=main], .content-area');
      const searchArea = mainContent || document.body;

      const productLinks = searchArea.querySelectorAll('a[href*="product"], a[href*="/p/"], a[href*="item"]');
      if (productLinks.length > 0) {
        const seenProducts = new Set<string>();
        const products: string[] = [];
        const links: string[] = [];

        productLinks.forEach(a => {
          // Skip navigation/menu links
          if (a.closest('nav, .navbar, .menu, .dropdown, header')) return;
          const text = a.textContent?.trim();
          if (text && text.length > 3 && text.length < 200 && !seenProducts.has(text)) {
            seenProducts.add(text);
            products.push(text);
            links.push((a as HTMLAnchorElement).href);
          }
        });

        if (products.length > 0) {
          extract['products'] = products;
          extract['links'] = links;
        }
      }

      // Also check for "no results" messages
      const noResultsEl = document.querySelector('#content p, .search-no-results, [class*=no-result]');
      if (noResultsEl) {
        const text = noResultsEl.textContent?.trim() || '';
        if (text.toLowerCase().includes('no product') || text.toLowerCase().includes('no result') || text.toLowerCase().includes('not found')) {
          extract['message'] = [text];
        }
      }

      return extract;
    });

    for (const [key, vals] of Object.entries(data)) {
      if (vals && vals.length > 0) {
        results[key] = vals;
      }
    }
  } catch (err) {
    console.log(`Auto-extraction failed: ${err}`);
  }

  return results;
}

async function extractPageMessages(page: Page): Promise<string[]> {
  try {
    return await page.evaluate(() => {
      const contentArea = document.querySelector('#content, main, [role=main], .content-area, .search-results');
      const root = contentArea || document.body;
      const messages: string[] = [];
      const seen = new Set<string>();

      const candidates = root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, .alert, .notice, .warning, .empty, [class*=empty], [class*=notice], [class*=no-result], [class*=no-product]');
      candidates.forEach(el => {
        const text = el.textContent?.trim() || '';
        if (text.length > 5 && text.length < 500 && !seen.has(text)) {
          seen.add(text);
          messages.push(text);
        }
      });

      return messages;
    });
  } catch {
    return [];
  }
}

async function aiFindMostRelevantMessage(page: Page, pageTitle: string, messages: string[]): Promise<string | null> {
  try {
    const available = await ollamaClient.isAvailable();
    const hasModel = await ollamaClient.hasModel("llama3.2");
    if (!available || !hasModel || messages.length === 0) return null;

    const domSummary = await getPageDomSummary(page);
    const messagesText = messages.map((m, i) => `[${i}] ${m}`).join('\n');

    const prompt = `You are analyzing a web page after a user action. The page title is: "${pageTitle}"

The following text messages were found on the page:
${messagesText}

DOM summary of interactive elements:
${domSummary.substring(0, 1500)}

Which message from the list is the MOST relevant status/error/info message the user should see after their action? Consider:
- "No results" or "no product found" messages
- Error messages
- Success/confirmation messages
- Status messages about the action result
- Ignore navigation text, menu items, headers that are just labels

Return ONLY the exact text of the most relevant message. If none are relevant status messages, return "NONE".`;

    const response = await ollamaClient.generate({ model: "llama3.2", prompt, options: { temperature: 0.1, num_predict: 200 } });
    const answer = response.trim();

    if (!answer || answer === "NONE" || answer.length < 3) return null;

    const match = messages.find(m => m.includes(answer) || answer.includes(m));
    return match || (answer.length > 5 ? answer : null);
  } catch {
    return null;
  }
}
