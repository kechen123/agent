import "dotenv/config";

function num(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function nonNegativeInt(key: string, fallback: number): number {
  const value = num(key, fallback);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function list(key: string): string[] {
  const raw = process.env[key] ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  apiKey: process.env.DEEPSEEK_API_KEY ?? "",
  baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  modelName: process.env.DEEPSEEK_MODEL ?? process.env.MODEL_NAME ?? "deepseek-v4-flash",
  temperature: num("MODEL_TEMPERATURE", 0),
  port: num("PORT", 3000),
  maxAgentRetries: nonNegativeInt("MAX_AGENT_RETRIES", 2),
  maxToolCalls: nonNegativeInt("MAX_TOOL_CALLS", 8),
  enabledTools: list("ENABLED_TOOLS"),
  enabledSkills: list("ENABLED_SKILLS"),
  databaseUrl: process.env.DATABASE_URL ?? "",
  embeddingApiKey: process.env.EMBEDDING_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? "",
  embeddingBaseURL: process.env.EMBEDDING_BASE_URL ?? process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-v3",
  embeddingDim: nonNegativeInt("EMBEDDING_DIM", 2048),
  autoRagDistanceThreshold: num("AUTO_RAG_DISTANCE_THRESHOLD", 0.55),
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
  jwtSecret: process.env.JWT_SECRET ?? "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
} as const;

export type AppConfig = typeof config;

export interface ConfigCheckIssue {
  key: string;
  code: "missing" | "invalid" | "insecure-default";
  message: string;
}

export interface RuntimeConfigCheck {
  ok: boolean;
  issues: ConfigCheckIssue[];
}

/**
 * 检查运行所需配置是否明显缺失或仍使用示例值。
 *
 * 这个函数只做“配置形状检查”，不调用外部 LLM / Embedding 服务。
 * 原因：ready 检查可能被部署平台频繁调用，不能因为检查接口而消耗 token、触发限流或产生费用。
 */
export function validateRuntimeConfig(): RuntimeConfigCheck {
  const issues: ConfigCheckIssue[] = [];

  if (!config.apiKey) {
    issues.push({ key: "DEEPSEEK_API_KEY", code: "missing", message: "聊天模型 API Key 未配置" });
  }
  if (!config.baseURL) {
    issues.push({ key: "DEEPSEEK_BASE_URL", code: "missing", message: "聊天模型 Base URL 未配置" });
  }
  if (!config.modelName) {
    issues.push({ key: "DEEPSEEK_MODEL", code: "missing", message: "聊天模型名称未配置" });
  }
  if (!config.databaseUrl) {
    issues.push({ key: "DATABASE_URL", code: "missing", message: "数据库连接字符串未配置" });
  }
  if (!config.jwtSecret) {
    issues.push({ key: "JWT_SECRET", code: "missing", message: "JWT 签名密钥未配置" });
  } else if (config.jwtSecret.includes("请换成")) {
    issues.push({ key: "JWT_SECRET", code: "insecure-default", message: "JWT_SECRET 仍是示例值" });
  }
  if (!config.embeddingApiKey) {
    issues.push({ key: "EMBEDDING_API_KEY", code: "missing", message: "Embedding API Key 未配置，且没有可用回退值" });
  }
  if (!config.embeddingBaseURL) {
    issues.push({ key: "EMBEDDING_BASE_URL", code: "missing", message: "Embedding Base URL 未配置" });
  }
  if (!config.embeddingModel) {
    issues.push({ key: "EMBEDDING_MODEL", code: "missing", message: "Embedding 模型名称未配置" });
  }
  if (!Number.isInteger(config.embeddingDim) || config.embeddingDim <= 0) {
    issues.push({ key: "EMBEDDING_DIM", code: "invalid", message: "Embedding 维度必须是正整数" });
  }
  if (!config.uploadDir) {
    issues.push({ key: "UPLOAD_DIR", code: "missing", message: "上传目录未配置" });
  }

  return { ok: issues.length === 0, issues };
}
