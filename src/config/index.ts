import "dotenv/config";

function num(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
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
  enabledTools: list("ENABLED_TOOLS"),
  enabledSkills: list("ENABLED_SKILLS"),
} as const;

export type AppConfig = typeof config;
