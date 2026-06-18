import { ChatOpenAI } from "@langchain/openai";
import { config } from "../config";

/**
 * Shared LLM client. All agents import this single instance.
 * Configuration (model, temperature, baseURL, apiKey) lives in config/index.ts / env.
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
