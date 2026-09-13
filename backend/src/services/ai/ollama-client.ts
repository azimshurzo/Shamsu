import axios, { AxiosInstance } from "axios";

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  images?: string[];
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
  };
}

export interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  total_duration?: number;
}

export interface OllamaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[];
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
  };
}

export interface OllamaChatResponse {
  model: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
}

class OllamaClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: OLLAMA_BASE_URL,
      timeout: 120000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.get("/api/tags");
      return true;
    } catch {
      return false;
    }
  }

  async getModels(): Promise<OllamaModel[]> {
    try {
      const response = await this.client.get<{ models: OllamaModel[] }>(
        "/api/tags"
      );
      return response.data.models || [];
    } catch {
      return [];
    }
  }

  async hasModel(modelName: string): Promise<boolean> {
    const models = await this.getModels();
    return models.some(
      (m) =>
        m.name === modelName ||
        m.name.startsWith(modelName + ":") ||
        m.name.split(":")[0] === modelName
    );
  }

  async findModel(modelName: string): Promise<string | null> {
    const models = await this.getModels();
    const exact = models.find(
      (m) => m.name === modelName || m.name.split(":")[0] === modelName
    );
    return exact ? exact.name : null;
  }

  async resolveModel(modelName: string): Promise<string> {
    const models = await this.getModels();
    const exact = models.find((m) => m.name === modelName);
    if (exact) return exact.name;
    const family = models.find((m) => m.name.split(":")[0] === modelName);
    return family ? family.name : modelName;
  }

  async generate(request: OllamaGenerateRequest): Promise<string> {
    const response = await this.client.post<OllamaGenerateResponse>(
      "/api/generate",
      {
        ...request,
        model: await this.resolveModel(request.model),
        stream: false,
      }
    );
    return response.data.response;
  }

  async chat(request: OllamaChatRequest): Promise<string> {
    const response = await this.client.post<OllamaChatResponse>(
      "/api/chat",
      {
        ...request,
        model: await this.resolveModel(request.model),
        stream: false,
      }
    );
    return response.data.message.content;
  }

  async generateWithVision(
    prompt: string,
    imageBase64: string,
    model: string = "llava"
  ): Promise<string> {
    return this.generate({
      model,
      prompt,
      images: [imageBase64],
      options: {
        temperature: 0.3,
        num_predict: 1024,
      },
    });
  }

  async analyzeWorkflow(
    recordedEvents: any[],
    pageUrl: string,
    pageTitle: string
  ): Promise<string> {
    const systemPrompt = `You are a workflow analysis assistant. Analyze the recorded browser events and identify:
1. The main goal of the workflow
2. All interactive elements (buttons, inputs, links)
3. The sequence of actions
4. Any patterns or repeated steps
5. Data fields that could be extracted

Respond in structured JSON format.`;

    const userPrompt = `Analyze this recorded workflow:

Page URL: ${pageUrl}
Page Title: ${pageTitle}

Recorded Events:
${JSON.stringify(recordedEvents, null, 2)}

Provide a structured analysis with:
- goal: The main objective of this workflow
- steps: Array of {action, target, value, purpose}
- patterns: Any repeated patterns
- extractableFields: Data that can be extracted
- suggestions: Improvements for reliability`;

    const response = await this.chat({
      model: "llama3.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      options: {
        temperature: 0.3,
        num_predict: 2048,
      },
    });

    return response;
  }
}

export const ollamaClient = new OllamaClient();
