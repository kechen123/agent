import { config } from "../config";

type EmbeddingResponse = {
  data?: { embedding?: unknown } | Array<{ embedding?: unknown }>;
  error?: unknown;
};

function assertEmbeddingConfig(): void {
  if (!config.embeddingApiKey) {
    throw new Error("EMBEDDING_API_KEY 未配置，且没有可回退的 DEEPSEEK_API_KEY");
  }
  if (!config.embeddingBaseURL) {
    throw new Error("EMBEDDING_BASE_URL 未配置");
  }
}

function normalizedBaseURL(): string {
  return config.embeddingBaseURL.replace(/\/$/, "");
}

function isArkMultimodalEndpoint(): boolean {
  return normalizedBaseURL().endsWith("/embeddings/multimodal");
}

function embeddingsUrl(): string {
  const baseURL = normalizedBaseURL();
  return isArkMultimodalEndpoint() ? baseURL : `${baseURL}/embeddings`;
}

function assertEmbeddingDim(vector: number[]): void {
  if (vector.length !== config.embeddingDim) {
    throw new Error(
      `Embedding 维度不匹配：期望 ${config.embeddingDim}，实际 ${vector.length}`,
    );
  }
}

function normalizeEmbedding(value: unknown): number[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "number")) {
    throw new Error("Embedding 接口返回了无法识别的向量格式");
  }
  assertEmbeddingDim(value);
  return value;
}

function extractEmbeddings(parsed: EmbeddingResponse | null, rawText: string): number[][] {
  const data = parsed?.data;
  if (Array.isArray(data)) {
    return data.map((item) => normalizeEmbedding(item.embedding));
  }
  if (data && typeof data === "object") {
    return [normalizeEmbedding(data.embedding)];
  }

  console.error("Embedding 响应格式异常", parsed ?? rawText);
  throw new Error("Embedding 接口返回格式异常：缺少 data.embedding");
}

async function requestEmbeddingBody(body: unknown): Promise<number[][]> {
  assertEmbeddingConfig();
  const res = await fetch(embeddingsUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.embeddingApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: EmbeddingResponse | null = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as EmbeddingResponse;
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    console.error("Embedding 请求失败", {
      status: res.status,
      statusText: res.statusText,
      url: embeddingsUrl(),
      model: config.embeddingModel,
      dimensions: config.embeddingDim,
      body: parsed ?? text,
    });
    const detail = parsed?.error ? JSON.stringify(parsed.error) : text || res.statusText;
    throw new Error(`Embedding 请求失败：${res.status} ${detail}`);
  }

  return extractEmbeddings(parsed, text);
}

async function requestEmbeddings(input: string | string[]): Promise<number[][]> {
  const texts = Array.isArray(input) ? input : [input];

  if (isArkMultimodalEndpoint()) {
    const vectors: number[][] = [];
    for (const text of texts) {
      const [vector] = await requestEmbeddingBody({
        model: config.embeddingModel,
        input: [{ type: "text", text }],
      });
      if (!vector) throw new Error("Embedding 接口没有返回向量");
      vectors.push(vector);
    }
    return vectors;
  }

  return requestEmbeddingBody({
    model: config.embeddingModel,
    input,
    dimensions: config.embeddingDim,
  });
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await requestEmbeddings(text);
  if (!vector) throw new Error("Embedding 接口没有返回 query 向量");
  return vector;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  return requestEmbeddings(texts);
}
