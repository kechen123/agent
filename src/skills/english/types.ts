import { z } from "zod";

// ─── 输入意图分类（router.ts 用来给 prompt 选 mode）──────────────────────────

export type EnglishInputType =
  | "chinese_to_english" // 用户给中文，想知道英文怎么说
  | "english_chat" // 英文对话 / 自由聊天
  | "correction" // 纠错 / 改错 / grammar
  | "explain_phrase" // 解释短语 / mean
  | "pronunciation" // 怎么读 / 发音
  | "mixed"; // 无法明确判断，让 LLM 自由决定

// ─── 学习者记忆（memory.ts 持久化在 Map 里）─────────────────────────────────

export interface EnglishLearnerMemory {
  /** 推测或自述的英语水平，例 "beginner" / "intermediate" / "advanced"。 */
  level: string;
  /** 用户的长期学习目标，例 "通过六级" / "能和外教自由交流"。 */
  goals: string[];
  /** 反复出错的表达 / 语法点，越靠前越近期。 */
  commonMistakes: string[];
  /** 已学过的关键短语（仅用于 prompt 上下文，长度有上限）。 */
  learnedPhrases: string[];
}

export const EmptyEnglishLearnerMemory: EnglishLearnerMemory = {
  level: "beginner",
  goals: [],
  commonMistakes: [],
  learnedPhrases: [],
};

// ─── Tutor 结构化输出（必须稳定 JSON）──────────────────────────────────────

export const EnglishTutorResponseSchema = z.object({
  mode: z
    .enum([
      "chinese_to_english",
      "english_chat",
      "correction",
      "explain_phrase",
      "pronunciation",
      "mixed",
    ])
    .describe("本轮模式，与用户输入类型对齐"),
  replyEn: z.string().describe("面向用户的英文回复 / 表达"),
  replyZh: z.string().describe("replyEn 的中文释义或解释"),
  pronunciation: z.object({
    text: z.string().describe("适合跟读的英文文本，可与 replyEn 一致"),
    tips: z
      .array(z.string())
      .describe("发音提示，例 ['重音在第二个音节', 'th 咬舌']"),
  }),
  correction: z
    .object({
      original: z.string().describe("用户给出的原句"),
      corrected: z.string().describe("修正后的句子"),
      reasonZh: z.string().describe("用中文解释为什么错、怎么改对"),
    })
    .optional()
    .describe("只有当用户给出英文且需要纠错时才填"),
  phrases: z
    .array(
      z.object({
        text: z.string().describe("短语原文"),
        meaningZh: z.string().describe("短语中文含义"),
        exampleEn: z.string().describe("短语在英文中的例句"),
        exampleZh: z.string().describe("例句的中文翻译"),
      }),
    )
    .describe("本轮涉及的关键词 / 短语拆解"),
  betterExpressions: z
    .array(
      z.object({
        text: z.string().describe("更地道的英文表达"),
        meaningZh: z.string().describe("该表达的中文含义"),
        usageZh: z.string().describe("使用场景 / 注意事项（中文）"),
      }),
    )
    .describe("比 replyEn 更地道的备选说法"),
  nextPractice: z
    .object({
      questionEn: z.string().describe("给用户跟练的英文问题 / 句型"),
      questionZh: z.string().describe("该问题的中文提示"),
    })
    .describe("引导用户继续学习的下一句练习"),
  /**
   * replyEn 的逐词对齐（前端做"点词发音"卡片用）。
   * - 顺序与 replyEn 中单词出现顺序一致；
   * - 标点单独成项（en 为标点，zh 为空串，ipa 可省略）；
   * - 短语动词（如 worn out）保持整体一个 en 字段，不要拆开；
   * - 中文译文尽量是词级直译，便于对齐。
   */
  wordByWord: z
    .array(
      z.object({
        en: z.string().describe("英文单词 / 标点"),
        zh: z.string().describe("该词的中文释义，标点可空串"),
        ipa: z.string().optional().describe("IPA 音标，可省略"),
      }),
    )
    .describe("replyEn 逐词对齐，顺序与句中一致"),
});

export type EnglishTutorResponse = z.infer<typeof EnglishTutorResponseSchema>;

/** 历史对话条目（service.ts 用来拼上下文，不持久化）。 */
export interface EnglishTutorHistoryItem {
  role: "user" | "assistant";
  content: string;
}
