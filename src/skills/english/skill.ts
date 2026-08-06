import type { Skill } from "../../types/agent";
import { buildEnglishSystemPrompt } from "./prompts";

/**
 * 英语外教 Skill。
 *
 * 接入方式：
 * - `description` 给 RouterAgent 看，用户输入涉及"学英语 / 翻译 / 练口语 / 纠错"时被自动选中。
 * - `systemPrompt` 注入到 ReplyAgent，让回复按英语外教风格 + 严格 JSON 输出。
 * - 暂不挂工具（dictionary / pronunciation 留到第二版）。
 */
export const englishSkill: Skill = {
  name: "english",
  description:
    "英语学习：中文翻译成自然英文、英文外教聊天、英文纠错、单词短语解释、发音提示。适合想学英语 / 翻译 / 练口语 / 改语法错误的用户。",
  systemPrompt: buildEnglishSystemPrompt(),
  // 第一版不挂工具；预留空数组表示"明确不使用任何工具"。
  tools: [],
};
