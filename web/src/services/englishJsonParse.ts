// 从 AssistantMessage 收到的 content 可能是:
//   1. 严格 JSON 字符串
//   2. ```json ... ``` 围栏块
//   3. 前面带一句寒暄 / 后面带一句"以上就是..."的解释段
//   4. 模型完全失守,输出了 Markdown 段落
//
// 解析策略:依次尝试 4 种抽取方式,再用字段白名单校验。
// 任意一步失败都返回 null,调用方决定是渲染卡片还是降级到 Markdown。

import type { EnglishTutorResponse } from "../types/english-tutor";

/** 必填字符串字段。correction / ipa 允许缺失。 */
const REQUIRED_STRING_FIELDS: Array<keyof EnglishTutorResponse> = [
  "mode",
  "replyEn",
  "replyZh",
];

const REQUIRED_ARRAY_FIELDS: Array<keyof EnglishTutorResponse> = [
  "phrases",
  "betterExpressions",
  "wordByWord",
];

const VALID_MODES = new Set([
  "chinese_to_english",
  "english_chat",
  "correction",
  "explain_phrase",
  "pronunciation",
  "mixed",
]);

export function parseEnglishTutorContent(
  content: string,
): EnglishTutorResponse | null {
  if (!content) return null;
  const candidates = [
    content,
    extractBalancedJson(content),
    extractFencedBlock(content, "json"),
    extractFencedBlock(content, ""),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (validate(parsed)) return parsed as EnglishTutorResponse;
    } catch {
      // 继续尝试下一个候选
    }
  }
  return null;
}

function validate(value: unknown): value is EnglishTutorResponse {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  for (const key of REQUIRED_STRING_FIELDS) {
    if (typeof obj[key] !== "string") return false;
  }
  for (const key of REQUIRED_ARRAY_FIELDS) {
    if (!Array.isArray(obj[key])) return false;
  }
  if (!VALID_MODES.has(obj.mode as string)) return false;
  if (
    !obj.pronunciation ||
    typeof obj.pronunciation !== "object" ||
    typeof (obj.pronunciation as { text?: unknown }).text !== "string" ||
    !Array.isArray((obj.pronunciation as { tips?: unknown }).tips)
  ) {
    return false;
  }
  if (
    !obj.nextPractice ||
    typeof obj.nextPractice !== "object" ||
    typeof (obj.nextPractice as { questionEn?: unknown }).questionEn !== "string" ||
    typeof (obj.nextPractice as { questionZh?: unknown }).questionZh !== "string"
  ) {
    return false;
  }
  // wordByWord 每项必须至少有 en/zh 两个字符串
  for (const item of obj.wordByWord as unknown[]) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof (item as { en?: unknown }).en !== "string" ||
      typeof (item as { zh?: unknown }).zh !== "string"
    ) {
      return false;
    }
  }
  return true;
}

function extractBalancedJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function extractFencedBlock(text: string, lang: string): string | null {
  // lang 为空时匹配 ``` 任意围栏
  const pattern = lang
    ? new RegExp("```" + lang + "\\s*([\\s\\S]*?)```", "i")
    : /```\s*([\s\S]*?)```/;
  const match = pattern.exec(text);
  return match ? match[1].trim() : null;
}
