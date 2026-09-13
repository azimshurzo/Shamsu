import { ollamaClient } from "../ai/ollama-client";

export interface VoiceIntentVariable {
  name: string;
  example: string;
  purpose: string;
}

export interface VoiceIntentExtraction {
  name: string;
  kind: string;
}

export interface VoiceIntent {
  apiName: string;
  description: string;
  targetUrl: string;
  action: string;
  variables: VoiceIntentVariable[];
  extractionTargets: VoiceIntentExtraction[];
}

const SYSTEM_PROMPT = `You convert a user's spoken request into a structured plan for building a web automation API.

The user says something like: "make a search api for walton.com.bd" or "create an api that searches products on amazon and returns names and prices".

You must reply with ONLY a valid JSON object (no markdown, no commentary) matching this exact schema:
{
  "apiName": "short human-friendly name, e.g. 'Walton Search API'",
  "description": "one sentence describing what the API does",
  "targetUrl": "the main website URL the user mentioned, normalized with https:// if missing. Never invent a URL - if the user didn't name a site, use an empty string",
  "action": "what the API should do, e.g. 'search'",
  "variables": [
    { "name": "short variable name like 'query'", "example": "a realistic example value, e.g. 'refrigerator'", "purpose": "what this variable fills in, e.g. 'search term'" }
  ],
  "extractionTargets": [
    { "name": "field key like 'products'", "kind": "type like 'name' or 'price'" }
  ]
}

Rules:
- variables: a search API should get exactly one variable (the search term). Only include a variable when the request implies user-supplied input.
- variables[].example MUST be a realistic example value for the site, never a generic word like "test", "example", or "sample" (e.g. for an electronics store use "refrigerator", for a bookstore use "python").
- extractionTargets: infer what data the user wants returned. For a product search this is usually name and price. Default to [{"name":"products","kind":"name"},{"name":"prices","kind":"price"}] if nothing specific is requested.
- targetUrl must be the real domain the user mentioned (e.g. walton.com.bd, amazon.com, daraz.com.bd). Prepend https:// when the user omits the protocol.`;

function normalizeUrl(url: string): string {
  let u = url.trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  const parsed = new URL(u);
  if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") return "";
  return parsed.href.replace(/\/$/, "");
}

export function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function sanitizeIntent(raw: any): VoiceIntent | null {
  if (!raw || typeof raw !== "object") return null;
  const targetUrl = normalizeUrl(String(raw.targetUrl || ""));
  const apiName = String(raw.apiName || "").trim().slice(0, 50);

  const variables: VoiceIntentVariable[] = Array.isArray(raw.variables)
    ? raw.variables
        .filter((v: any) => v && typeof v === "object")
        .map((v: any) => ({
          name: String(v.name || "query").trim().slice(0, 50),
          example: String(v.example || "test").trim().slice(0, 100),
          purpose: String(v.purpose || "").trim().slice(0, 100),
        }))
        .filter((v: VoiceIntentVariable) => v.name)
    : [];

  const extractionTargets: VoiceIntentExtraction[] = Array.isArray(raw.extractionTargets)
    ? raw.extractionTargets
        .filter((t: any) => t && typeof t === "object")
        .map((t: any) => ({
          name: String(t.name || "products").trim().slice(0, 50),
          kind: String(t.kind || "name").trim().slice(0, 50),
        }))
        .filter((t: VoiceIntentExtraction) => t.name)
    : [];

  if (!targetUrl || !apiName) return null;

  const description =
    String(raw.description || "").trim().slice(0, 300) ||
    `${actionLabel(String(raw.action || "search"))} on ${new URL(targetUrl).hostname}`;

  return {
    apiName,
    description,
    targetUrl,
    action: String(raw.action || "search").toUpperCase().slice(0, 30),
    variables,
    extractionTargets:
      extractionTargets.length > 0
        ? extractionTargets
        : [
            { name: "products", kind: "name" },
            { name: "prices", kind: "price" },
          ],
  };
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    search: "Searches for results",
    check: "Checks information",
    track: "Tracks information",
    order: "Places an order",
  };
  return map[action.toLowerCase()] || "Performs an action";
}

export async function parseVoiceIntent(transcript: string): Promise<VoiceIntent> {
  if (!transcript || !transcript.trim()) {
    throw new Error("No command was heard");
  }

  const available = await ollamaClient.isAvailable();
  const hasModel = await ollamaClient.hasModel("llama3.2");
  if (!available || !hasModel) {
    throw new Error("Ollama is not running or llama3.2 is not installed");
  }

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const userPrompt = `Convert this request into the JSON plan:\n"${transcript}"\n\n${
      attempt === 1 ? `Your previous output was invalid: ${lastError}. Reply with ONLY valid JSON.` : ""
    }`;

    const response = await ollamaClient.chat({
      model: "llama3.2",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      options: { temperature: 0.1, num_predict: 512 },
    });

    const json = extractJson(response);
    if (!json) {
      lastError = "no JSON object found in response";
      continue;
    }

    try {
      const intent = sanitizeIntent(JSON.parse(json));
      if (intent) return intent;
      lastError = "required fields missing (targetUrl or apiName)";
    } catch (e: any) {
      lastError = `invalid JSON: ${e.message}`;
    }
  }

  throw new Error(`Could not understand the command: ${lastError}`);
}
