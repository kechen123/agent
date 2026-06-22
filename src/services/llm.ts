import { ChatOpenAI } from "@langchain/openai";
import { config } from "../config";

/**
 * 共享 LLM 客户端。所有 Agent 都导入这个单例。
 * 配置（model、temperature、baseURL、apiKey）来自 config/index.ts / env。
 */
export const model = new ChatOpenAI({
  model: config.modelName,
  temperature: config.temperature,
  configuration: {
    baseURL: config.baseURL,
  },
  apiKey: config.apiKey,
  modelKwargs: {
    thinking: { type: "disabled" },
  },
});
