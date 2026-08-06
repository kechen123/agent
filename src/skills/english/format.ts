import { EnglishTutorResponseSchema, type EnglishTutorResponse } from "./types";

/**
 * 兜底解析：LLM 偶发会把 JSON 包在 ```json ... ``` 里，甚至在前面加解释。
 * 本函数按顺序尝试：1) 整段 JSON.parse 2) 截取第一个 {...} 块 3) 截取 ```json 块。
 * 解析成功后再过一遍 Zod 校验，失败一律返回 null（调用方决定如何兜底）。
 */
export function extractEnglishJson(text: string): EnglishTutorResponse | null {
  const attempts = [
    text,
    extractBalancedJson(text),
    extractFencedBlock(text, "json"),
  ];

  for (const candidate of attempts) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      const result = EnglishTutorResponseSchema.safeParse(parsed);
      if (result.success) return result.data;
    } catch {
      // 继续尝试下一个候选
    }
  }
  return null;
}

/** 提取第一对匹配的 {...}，允许跨行。 */
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

/** 提取 ```lang ... ``` 围栏内容，例 ```json ... ```。 */
function extractFencedBlock(text: string, lang: string): string | null {
  const re = new RegExp("```" + lang + "\\s*([\\s\\S]*?)```", "i");
  const match = re.exec(text);
  return match ? match[1].trim() : null;
}

/** 把结构化响应序列化为友好 JSON，供 SSE 消息体直接展示。 */
export function safeStringifyEnglish(response: EnglishTutorResponse): string {
  return JSON.stringify(response, null, 2);
}
