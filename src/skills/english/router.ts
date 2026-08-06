import type { EnglishInputType } from "./types";

/** 中文字符比例阈值：>= 30% 视为中文为主。 */
const CHINESE_RATIO_THRESHOLD = 0.3;

/**
 * 简单输入分类器。规则优先：先看关键词，再看中英文比例。
 * 第一版不调用 LLM，速度快、可解释，便于单元测试。
 */
export function classifyEnglishInput(text: string): EnglishInputType {
  const normalized = text.trim();
  if (!normalized) return "mixed";

  const lower = normalized.toLowerCase();

  // 1. 关键词优先于比例判断
  if (/(纠正|改错|语法|grammar)/u.test(lower)) return "correction";
  if (/(怎么读|发音|pronounce|pronunciation)/u.test(lower)) return "pronunciation";
  if (/(什么意思|怎么讲|解释一下|mean|meaning|means)/u.test(lower)) return "explain_phrase";
  if (/(怎么说|翻译|英文怎么|英文表达|用英语说|in english)/u.test(lower)) {
    return "chinese_to_english";
  }

  // 2. 中英比例
  const ratio = chineseCharRatio(normalized);
  if (ratio >= CHINESE_RATIO_THRESHOLD) return "chinese_to_english";
  if (ratio <= 0.1) return "english_chat";

  return "mixed";
}

/** 中文字符占总字符数的比例（不含空白与标点）。 */
export function chineseCharRatio(text: string): number {
  const meaningful = text.replace(/[\s\p{P}]/gu, "");
  if (!meaningful) return 0;
  const chinese = (meaningful.match(/[一-鿿]/gu) ?? []).length;
  return chinese / meaningful.length;
}
