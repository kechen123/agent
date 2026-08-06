import { ChatPromptTemplate } from "@langchain/core/prompts";
import { model } from "../../services/llm";
import { logger } from "../../observability/logger";
import {
  EnglishTutorResponseSchema,
  type EnglishTutorResponse,
  type EnglishTutorHistoryItem,
} from "./types";
import { buildEnglishSystemPrompt } from "./prompts";
import { classifyEnglishInput } from "./router";
import { englishMemoryStore } from "./memory";
import { extractEnglishJson } from "./format";

/** 历史对话（可选）— 仅最近 6 轮，避免 prompt 过大。 */
export type { EnglishTutorHistoryItem };

export interface RunEnglishTutorInput {
  threadId: string;
  userText: string;
  history?: EnglishTutorHistoryItem[];
}

const structuredModel = model.withStructuredOutput(EnglishTutorResponseSchema, {
  name: "english_tutor_response",
  method: "functionCalling",
});

/**
 * 直接调用 LLM 生成英语外教回复。
 *
 * 流程：
 *  1. 预分类 inputType（仅用于日志与记忆更新，不直接喂给 LLM，让 LLM 自己再判断）
 *  2. 组装 system prompt（含学习者画像 + 少样本）
 *  3. 用 withStructuredOutput 强制 JSON 形状
 *  4. 解析后写回记忆（常错 / 短语）
 *  5. 失败时走兜底 JSON 解析
 */
export async function runEnglishTutor(
  input: RunEnglishTutorInput,
): Promise<EnglishTutorResponse> {
  const { threadId, userText } = input;
  const presetType = classifyEnglishInput(userText);
  const memory = englishMemoryStore.read(threadId);

  const systemPrompt = buildEnglishSystemPrompt(memory);
  const history = (input.history ?? []).slice(-6);
  const recentText = history
    .map((item) => `${item.role === "user" ? "学生" : "老师"}：${item.content}`)
    .join("\n");

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    [
      "human",
      `预判 inputType：${presetType}\n最近对话：\n${recentText || "（无）"}\n\n本轮学生输入：\n${userText}\n\n请按 system prompt 的 JSON 契约输出。`,
    ],
  ]);

  const chain = prompt.pipe(structuredModel);

  let response: EnglishTutorResponse;
  try {
    const raw = (await chain.invoke({})) as EnglishTutorResponse;
    // withStructuredOutput 应当已经返回解析后的对象；再过一遍 Zod 保证。
    const verified = EnglishTutorResponseSchema.safeParse(raw);
    if (!verified.success) {
      throw new Error(
        `EnglishTutor response failed schema: ${verified.error.message}`,
      );
    }
    response = verified.data;
  } catch (err) {
    logger.warn("english.tutor.structured.failed", {
      threadId,
      presetType,
      error: err instanceof Error ? err.message : String(err),
    });
    // 兜底：让模型输出纯文本，再走 extractEnglishJson。
    const fallback = await model.invoke(
      `${systemPrompt}\n\n学生：${userText}\n\n只输出 JSON。`,
    );
    const text =
      typeof fallback.content === "string"
        ? fallback.content
        : Array.isArray(fallback.content)
          ? fallback.content
              .map((part) => (typeof part === "string" ? part : ""))
              .join("")
          : "";
    const parsed = extractEnglishJson(text);
    if (!parsed) {
      throw new Error("EnglishTutor failed to produce valid JSON response");
    }
    response = parsed;
  }

  // 写回学习者记忆
  if (response.correction?.reasonZh) {
    englishMemoryStore.appendMistake(threadId, response.correction.original);
  }
  for (const phrase of response.phrases.slice(0, 3)) {
    englishMemoryStore.addLearnedPhrase(threadId, phrase.text);
  }

  logger.info("english.tutor.done", {
    threadId,
    presetType,
    mode: response.mode,
    phrases: response.phrases.length,
    corrected: Boolean(response.correction),
  });

  return response;
}
