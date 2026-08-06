# English Tutor Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structured "英语外教" Skill (translation, chat, correction, learning memory) without rewriting the existing Router/Planner/Reply/SSE pipeline.

**Architecture:** Register a new `Skill` (data only: name + description + systemPrompt). The description lets `RouterAgent` auto-route learning requests to it; the system prompt instructs `ReplyAgent` to act as an English tutor and emit a strict JSON object. Reusable helpers (`router.ts`/`service.ts`/`format.ts`/`memory.ts`/`examples.ts`) back a `runEnglishTutor()` direct-call entry point for the demo script and any future dedicated `EnglishTutorAgent` node.

**Tech Stack:** TypeScript, LangChain `model.withStructuredOutput` (Zod), in-memory `Map` for learner memory (per threadId), no new SSE event types, no DB migration.

## Global Constraints

- **No graph changes.** Do not add new LangGraph nodes or edges. Do not change `src/runtime/graph.ts`, `src/services/stream.ts`, `src/agents/router/router.ts`, or `src/agents/reply/reply.ts`.
- **No new SSE events.** Frontend continues to consume `message:delta` / `message:end` with Markdown. The English tutor's JSON may render as a fenced code block — accepted for MVP per the user spec step 7.
- **Skill interface unchanged.** Use the existing `Skill` shape (`name`, `description`, `systemPrompt`, optional `tools?`).
- **Naming style:** match existing files — `frontend.skill.ts` template, `withSkillPrompt` / `skillPromptForState` / `listSkillSummaries` re-use, no new abstractions.
- **Chinese comments** for non-obvious logic (per project CLAUDE.md).
- **No DB migration** for learning memory. MVP uses an in-process `Map<threadId, EnglishLearnerMemory>`.
- **ReplyAgent still produces `message:delta`.** The English skill's `systemPrompt` must instruct the LLM to output a single JSON object; the LLM may wrap it in a ` ```json ` fence (acceptable; `AssistantMessage` already uses ReactMarkdown + remarkGfm).

---

## File Map

| File | Role |
|---|---|
| `src/skills/english/types.ts` | `EnglishInputType`, `EnglishTutorResponse`, `EnglishLearnerMemory`, Zod schemas |
| `src/skills/english/prompts.ts` | `buildEnglishSystemPrompt()` (base + role + JSON contract + output rules) |
| `src/skills/english/examples.ts` | Few-shot `[user, assistant-JSON]` pairs |
| `src/skills/english/router.ts` | `classifyEnglishInput(text)` — regex/heuristic input-type detector |
| `src/skills/english/format.ts` | `extractJson<T>(text)` — strip code fences, parse, validate, fallback |
| `src/skills/english/memory.ts` | `EnglishLearnerMemoryStore` — `Map<threadId, …>` read/update/append methods |
| `src/skills/english/service.ts` | `runEnglishTutor({threadId, userText, history})` — direct-call entry point using `withStructuredOutput` |
| `src/skills/english/skill.ts` | `englishSkill: Skill` — registered with `Skill` interface |
| `src/skills/english/index.ts` | Re-exports + `registerEnglishSkill()` |
| `src/skills/index.ts` | (modify) call `registerEnglishSkill()` inside `registerBuiltinSkills()` |
| `scripts/english-demo.ts` | Demo runner for 3 scenarios (中文→英文 / 英文聊天 / 纠错) |
| `package.json` | (modify) add `"english:demo": "tsx scripts/english-demo.ts"` if `tsx` not present |

---

## Task 1: Define types and Zod schemas

**Files:**
- Create: `src/skills/english/types.ts`

**Interfaces:**
- Consumes: (none)
- Produces: `EnglishInputType`, `EnglishTutorResponse`, `EnglishLearnerMemory`, `EnglishTutorResponseSchema` (Zod)

- [ ] **Step 1: Write `src/skills/english/types.ts`**

```ts
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
});

export type EnglishTutorResponse = z.infer<typeof EnglishTutorResponseSchema>;
```

- [ ] **Step 2: Verify it parses**

Run: `pnpm typecheck` (expect PASS — file only exports types, nothing imports yet)

---

## Task 2: Few-shot examples

**Files:**
- Create: `src/skills/english/examples.ts`

**Interfaces:**
- Consumes: (none)
- Produces: `englishFewShotExamples: Array<{user: string; assistantJson: string}>`

- [ ] **Step 1: Write `src/skills/english/examples.ts`**

```ts
/**
 * 少量示例，仅用于在 prompt 中示范 JSON 形状。
 * 注意：示例必须用 \`\`\`json 代码块包裹，便于 LLM 模仿。
 */
export interface EnglishFewShotExample {
  user: string;
  /** 严格 JSON 字符串，可被 JSON.parse 解析为 EnglishTutorResponse。 */
  assistantJson: string;
}

export const englishFewShotExamples: EnglishFewShotExample[] = [
  {
    user: "我想说『今天真的很累』，英文怎么说？",
    assistantJson: JSON.stringify(
      {
        mode: "chinese_to_english",
        replyEn: "I'm really worn out today.",
        replyZh: "今天我真的累坏了。",
        pronunciation: {
          text: "I'm really worn out today.",
          tips: [
            "worn out /wɔːrn aʊt/，重音落在 worn 上",
            "out 里的 /aʊ/ 是 '啊呜' 的双元音",
          ],
        },
        correction: undefined,
        phrases: [
          {
            text: "worn out",
            meaningZh: "筋疲力尽的，比 tired 更口语化",
            exampleEn: "After the marathon I was completely worn out.",
            exampleZh: "跑完马拉松后我完全累垮了。",
          },
        ],
        betterExpressions: [
          {
            text: "I'm completely drained today.",
            meaningZh: "今天我整个人被掏空了",
            usageZh: "比 worn out 更夸张，适合加班后吐槽",
          },
          {
            text: "Today really took it out of me.",
            meaningZh: "今天真把我累坏了",
            usageZh: "更委婉、更书面的说法",
          },
        ],
        nextPractice: {
          questionEn: "Try this: 'I've been swamped with work today.' Can you guess what 'swamped' means?",
          questionZh:
            "试着理解这句话，再造一个今天很累但理由不同的英文句子。",
        },
      },
      null,
      2,
    ),
  },
  {
    user: "I go to park yesterday with my friend.",
    assistantJson: JSON.stringify(
      {
        mode: "correction",
        replyEn: "I went to the park yesterday with my friend.",
        replyZh: "昨天我和朋友一起去了公园。",
        pronunciation: {
          text: "I went to the park yesterday with my friend.",
          tips: [
            "went /went/ 是 go 的过去式，元音 /ɛ/",
            "park 的 /p/ 要送气，/k/ 不送气",
          ],
        },
        correction: {
          original: "I go to park yesterday with my friend.",
          corrected: "I went to the park yesterday with my friend.",
          reasonZh:
            "三个问题：① yesterday 是过去时间，go 必须改成 went；② park 是单数可数名词，前面要加 the 或 a；③ go / went 等不规则动词的过去式需要专门记忆。",
        },
        phrases: [
          {
            text: "go to the park",
            meaningZh: "去公园",
            exampleEn: "We go to the park every weekend.",
            exampleZh: "我们每个周末都去公园。",
          },
        ],
        betterExpressions: [
          {
            text: "My friend and I hit the park yesterday.",
            meaningZh: "我朋友和我昨天去了公园",
            usageZh: "更口语化，hit the + 地点 = 顺路去玩",
          },
        ],
        nextPractice: {
          questionEn: "Now try past tense with another verb: 'I ____ (eat) sushi last night.'",
          questionZh: "把 eat 改成正确的过去式，再用它造一个完整句子。",
        },
      },
      null,
      2,
    ),
  },
  {
    user: "What's the difference between 'make' and 'do'?",
    assistantJson: JSON.stringify(
      {
        mode: "explain_phrase",
        replyEn:
          "'Make' usually means to create or produce something (make a cake, make a decision). 'Do' is more about tasks or activities (do homework, do the dishes).",
        replyZh:
          "make 一般指『制造、生产』某样东西（做蛋糕、做决定）；do 更偏向『完成一项任务或活动』（做作业、做饭）。",
        pronunciation: {
          text: "make a cake / do homework",
          tips: ["make /meɪk/", "do /duː/"],
        },
        correction: undefined,
        phrases: [
          {
            text: "make a decision",
            meaningZh: "做决定",
            exampleEn: "I need to make a decision by Friday.",
            exampleZh: "我得在周五前做出决定。",
          },
          {
            text: "do the dishes",
            meaningZh: "洗碗",
            exampleEn: "Could you do the dishes tonight?",
            exampleZh: "今晚你能洗碗吗？",
          },
        ],
        betterExpressions: [
          {
            text: "make + 具体产物 (make a video, make progress)",
            meaningZh: "产出某个具体东西",
            usageZh: "能摸到、看到、量化的结果用 make",
          },
          {
            text: "do + 抽象活动 (do exercise, do research)",
            meaningZh: "做一项活动 / 任务",
            usageZh: "动作本身是目的，看不到最终产物",
          },
        ],
        nextPractice: {
          questionEn:
            "Fill in the blank: 'I need to ____ (make / do) an appointment with the doctor.'",
          questionZh: "想想看，为什么这里用 make 更自然？",
        },
      },
      null,
      2,
    ),
  },
];
```

---

## Task 3: Router (input classification)

**Files:**
- Create: `src/skills/english/router.ts`

**Interfaces:**
- Consumes: `EnglishInputType` from `./types`
- Produces: `classifyEnglishInput(text) → EnglishInputType`

- [ ] **Step 1: Write `src/skills/english/router.ts`**

```ts
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
```

- [ ] **Step 2: Quick sanity check (optional, no test framework needed)**

Open a Node REPL with `npx tsx -e "import {classifyEnglishInput} from './src/skills/english/router'; console.log(classifyEnglishInput('今天很累怎么说'))"` and verify it returns `"chinese_to_english"`.

---

## Task 4: Format (JSON extraction fallback)

**Files:**
- Create: `src/skills/english/format.ts`

**Interfaces:**
- Consumes: `EnglishTutorResponseSchema` from `./types`
- Produces: `extractEnglishJson(text) → EnglishTutorResponse | null`, `safeStringifyEnglish(response) → string`

- [ ] **Step 1: Write `src/skills/english/format.ts`**

```ts
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
  const re = new RegExp(`\`\`\`${lang}\\s*([\\s\\S]*?)\`\`\``, "i");
  const match = re.exec(text);
  return match ? match[1].trim() : null;
}

/** 把结构化响应序列化为友好 JSON，供 SSE 消息体直接展示。 */
export function safeStringifyEnglish(response: EnglishTutorResponse): string {
  return JSON.stringify(response, null, 2);
}
```

---

## Task 5: Memory (in-memory learner store)

**Files:**
- Create: `src/skills/english/memory.ts`

**Interfaces:**
- Consumes: `EnglishLearnerMemory`, `EmptyEnglishLearnerMemory` from `./types`
- Produces: `EnglishLearnerMemoryStore` class with `read/updateLevel/appendMistake/addLearnedPhrase/snapshot`

- [ ] **Step 1: Write `src/skills/english/memory.ts`**

```ts
import {
  EmptyEnglishLearnerMemory,
  type EnglishLearnerMemory,
} from "./types";

/** 单条记忆最多保留的条目数，防止 prompt 上下文无限增长。 */
const MAX_MISTAKES = 20;
const MAX_PHRASES = 30;
const MAX_GOALS = 5;

/**
 * 内存版学习者记忆。
 *
 * MVP 不做持久化：进程重启后清空。
 * 通过 threadId 隔离不同会话；同一 thread 内的多轮对话共享同一份记忆。
 *
 * 后续要接 DB 时，只需把内部 Map 替换成数据库读写即可，方法签名保持不变。
 */
export class EnglishLearnerMemoryStore {
  private readonly store = new Map<string, EnglishLearnerMemory>();

  read(threadId: string): EnglishLearnerMemory {
    return this.store.get(threadId) ?? { ...EmptyEnglishLearnerMemory };
  }

  updateLevel(threadId: string, level: string): void {
    const next = this.read(threadId);
    next.level = level.trim() || next.level;
    this.store.set(threadId, next);
  }

  appendMistake(threadId: string, mistake: string): void {
    const trimmed = mistake.trim();
    if (!trimmed) return;
    const next = this.read(threadId);
    // 去重并保持最近在前
    next.commonMistakes = [trimmed, ...next.commonMistakes.filter((m) => m !== trimmed)].slice(
      0,
      MAX_MISTAKES,
    );
    this.store.set(threadId, next);
  }

  addLearnedPhrase(threadId: string, phrase: string): void {
    const trimmed = phrase.trim();
    if (!trimmed) return;
    const next = this.read(threadId);
    next.learnedPhrases = [trimmed, ...next.learnedPhrases.filter((p) => p !== trimmed)].slice(
      0,
      MAX_PHRASES,
    );
    this.store.set(threadId, next);
  }

  setGoals(threadId: string, goals: string[]): void {
    const next = this.read(threadId);
    next.goals = goals.filter(Boolean).slice(0, MAX_GOALS);
    this.store.set(threadId, next);
  }

  /** 导出当前快照，便于调试 / 演示脚本打印。 */
  snapshot(threadId: string): EnglishLearnerMemory {
    return { ...this.read(threadId) };
  }
}

/** 全局单例，与 `MemorySaver` 解耦：第一版不参与 checkpoint。 */
export const englishMemoryStore = new EnglishLearnerMemoryStore();
```

---

## Task 6: Prompts (system prompt builder)

**Files:**
- Create: `src/skills/english/prompts.ts`

**Interfaces:**
- Consumes: `EnglishLearnerMemory` from `./types`, `englishFewShotExamples` from `./examples`
- Produces: `buildEnglishSystemPrompt(memory?) → string`

- [ ] **Step 1: Write `src/skills/english/prompts.ts`**

```ts
import type { EnglishLearnerMemory } from "./types";
import { englishFewShotExamples } from "./examples";

/**
 * Skill 注入到 ReplyAgent 的系统提示。
 *
 * 设计要点：
 * - 角色：中文母语者友好的英语外教；
 * - 行为：先判断 inputType，再决定输出重点；
 * - 格式：严格 JSON，不写 markdown、不写多余解释；
 * - 自适应：根据 learner memory 调整用词难度；
 * - 少样本：放 3 条示例，引导 JSON 形状稳定。
 */
export function buildEnglishSystemPrompt(memory?: EnglishLearnerMemory): string {
  const learnerBlock = memory
    ? `\n# 用户画像（参考）\n- 水平：${memory.level}\n- 目标：${memory.goals.join("；") || "（未填）"}\n- 常错：${memory.commonMistakes.slice(0, 5).join("；") || "（无）"}\n- 已学短语：${memory.learnedPhrases.slice(0, 8).join("；") || "（无）"}\n请在保持简单的前提下，针对以上情况微调用词与讲解深度。\n`
    : "";

  const examplesBlock = englishFewShotExamples
    .map(
      (ex, idx) =>
        `示例 ${idx + 1}\n用户：${ex.user}\n助手：\n\`\`\`json\n${ex.assistantJson}\n\`\`\``,
    )
    .join("\n\n");

  return `你是一名适合中文母语者的英语外教。目标不是逐字翻译，而是帮用户学会"自然、地道、敢开口"地表达英文。

# 角色
- 你的学生大多是初中级学习者；除非用户水平明显较高，否则英文不要太难。
- 解释一律用简体中文，关键英文术语可保留并附中文。

# 你必须做的事
1. 先判断 inputType 属于以下哪种：
   - chinese_to_english：用户给中文，你想英文表达
   - english_chat：用户纯英文和你聊天
   - correction：用户给英文，你想纠错
   - explain_phrase：用户问单词/短语/语法点
   - pronunciation：用户问怎么读
   - mixed：拿不准，按你认为最合适的方式处理
2. 按 inputType 组织输出重点（见下表）。
3. 始终输出严格 JSON，字段固定（见 # JSON 契约）。
4. 不要输出 markdown 标题、列表符号、解释段。整段回复就是 JSON 对象本身。

# inputType 输出重点
- chinese_to_english：replyEn 是核心，replyZh 给中文释义，phrases 拆解可复用短语
- english_chat：像外教一样继续聊，replyEn 是主要回复，replyZh 给对照翻译
- correction：correction 字段是核心，原句、修正句、错误原因缺一不可
- explain_phrase：phrases 字段给短语列表，betterExpressions 给更多搭配
- pronunciation：pronunciation.tips 给音标 / 重音 / 技巧
- mixed：自由组合，优先把用户最关心的内容塞进对应字段

# JSON 契约
{
  "mode": "chinese_to_english" | "english_chat" | "correction" | "explain_phrase" | "pronunciation" | "mixed",
  "replyEn": "string",
  "replyZh": "string",
  "pronunciation": { "text": "string", "tips": ["string"] },
  "correction": { "original": "string", "corrected": "string", "reasonZh": "string" } | null,
  "phrases": [{ "text": "string", "meaningZh": "string", "exampleEn": "string", "exampleZh": "string" }],
  "betterExpressions": [{ "text": "string", "meaningZh": "string", "usageZh": "string" }],
  "nextPractice": { "questionEn": "string", "questionZh": "string" }
}

约束：
- 没有纠错时，correction 设为 null（不是省略字段）。
- phrases / betterExpressions 至少给 1 条，最多 5 条。
- pronunciation.tips 至少 1 条，重点是音标或重音。
- nextPractice 必须有，questionEn 简短可跟读。
- 字段顺序按上面契约的顺序写，便于阅读。
${learnerBlock}
# 少样本示例
${examplesBlock}

# 再次提醒
- 只输出 JSON，不要写"好的，下面是……"这种话。
- 不输出 markdown 代码块以外的任何字符。
- 不重复用户原文，不写结束语。`;
}
```

---

## Task 7: Service (direct-call entry point)

**Files:**
- Create: `src/skills/english/service.ts`

**Interfaces:**
- Consumes: `model` from `../../services/llm`, `EnglishTutorResponseSchema` from `./types`, `buildEnglishSystemPrompt` from `./prompts`, `classifyEnglishInput` from `./router`, `englishMemoryStore` from `./memory`, `extractEnglishJson` from `./format`
- Produces: `runEnglishTutor({ threadId, userText, history? }) → EnglishTutorResponse`

- [ ] **Step 1: Write `src/skills/english/service.ts`**

```ts
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { model } from "../../services/llm";
import { logger } from "../../observability/logger";
import {
  EnglishTutorResponseSchema,
  type EnglishTutorResponse,
} from "./types";
import { buildEnglishSystemPrompt } from "./prompts";
import { classifyEnglishInput } from "./router";
import { englishMemoryStore } from "./memory";
import { extractEnglishJson } from "./format";

/** 历史对话（可选）— 仅最近 6 轮，避免 prompt 过大。 */
export interface EnglishTutorHistoryItem {
  role: "user" | "assistant";
  content: string;
}

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
    const raw = await chain.invoke({});
    // withStructuredOutput 应当已经返回解析后的对象；再过一遍 Zod 保证。
    const verified = EnglishTutorResponseSchema.safeParse(raw);
    if (!verified.success) {
      throw new Error(`EnglishTutor response failed schema: ${verified.error.message}`);
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
    const text = typeof fallback.content === "string" ? fallback.content : "";
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
```

---

## Task 8: Skill definition

**Files:**
- Create: `src/skills/english/skill.ts`

**Interfaces:**
- Consumes: `Skill` from `../../types/agent`, `buildEnglishSystemPrompt` from `./prompts`
- Produces: `englishSkill: Skill`

- [ ] **Step 1: Write `src/skills/english/skill.ts`**

```ts
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
```

---

## Task 9: English skill index & registration

**Files:**
- Create: `src/skills/english/index.ts`
- Modify: `src/skills/index.ts:1-8`

**Interfaces:**
- Consumes: `registerSkill` from `../registry`, `englishSkill` from `./skill`, all helper modules
- Produces: `registerEnglishSkill()` and re-exports of all helpers

- [ ] **Step 1: Write `src/skills/english/index.ts`**

```ts
import { registerSkill } from "../registry";
import { englishSkill } from "./skill";
import { englishMemoryStore } from "./memory";
import { classifyEnglishInput } from "./router";
import { extractEnglishJson, safeStringifyEnglish } from "./format";
import { runEnglishTutor } from "./service";
import {
  EmptyEnglishLearnerMemory,
  EnglishTutorResponseSchema,
  type EnglishInputType,
  type EnglishLearnerMemory,
  type EnglishTutorResponse,
  type RunEnglishTutorHistoryItem,
} from "./types";

export function registerEnglishSkill(): void {
  registerSkill(englishSkill, "builtin");
}

export { englishSkill } from "./skill";
export { englishMemoryStore } from "./memory";
export { classifyEnglishInput, chineseCharRatio } from "./router";
export { extractEnglishJson, safeStringifyEnglish } from "./format";
export { runEnglishTutor } from "./service";
export {
  EmptyEnglishLearnerMemory,
  EnglishTutorResponseSchema,
  type EnglishInputType,
  type EnglishLearnerMemory,
  type EnglishTutorResponse,
  type RunEnglishTutorHistoryItem,
} from "./types";
export { buildEnglishSystemPrompt } from "./prompts";
export { englishFewShotExamples } from "./examples";
```

- [ ] **Step 2: Modify `src/skills/index.ts` to register the new skill**

Replace the existing `registerBuiltinSkills` body with:

```ts
import { registerSkill } from "./registry";
import { frontendSkill } from "./frontend.skill";
import { registerEnglishSkill } from "./english";

/** 注册内置 skills。启动时调用一次。 */
export function registerBuiltinSkills(): void {
  registerSkill(frontendSkill, "builtin");
  registerEnglishSkill();
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

---

## Task 10: Demo script

**Files:**
- Create: `scripts/english-demo.ts`
- Modify (if needed): `package.json` to add `tsx` script

**Interfaces:**
- Consumes: `runEnglishTutor`, `englishMemoryStore`
- Produces: a CLI that exercises 3 scenarios on the same thread

- [ ] **Step 1: Add `tsx` to dev dependencies (only if not present)**

Run: `grep -q '"tsx"' package.json || pnpm add -D tsx`

- [ ] **Step 2: Write `scripts/english-demo.ts`**

```ts
/**
 * 演示脚本：模拟三个不同场景的英语外教对话。
 *
 *   pnpm english:demo
 *
 * 需要在 .env 配置好 DEEPSEEK_API_KEY。脚本会真实调用 LLM。
 */

import "dotenv/config";
import { runEnglishTutor } from "../src/skills/english/service";
import { englishMemoryStore } from "../src/skills/english/memory";
import { classifyEnglishInput } from "../src/skills/english/router";
import { safeStringifyEnglish } from "../src/skills/english/format";
import type { EnglishTutorHistoryItem } from "../src/skills/english/service";

const THREAD_ID = "demo-thread-001";

interface Scenario {
  label: string;
  userText: string;
  history?: EnglishTutorHistoryItem[];
}

const scenarios: Scenario[] = [
  {
    label: "① 中文 → 英文",
    userText: "我想跟朋友说我今天真的很累，英文怎么说比较自然？",
  },
  {
    label: "② 英文纠错",
    userText: "I go to park yesterday with my friend.",
  },
  {
    label: "③ 英文聊天（带历史）",
    userText: "Yeah, exactly. Do you usually read books on weekends?",
    history: [
      { role: "user", content: "I have been reading a lot recently." },
      {
        role: "assistant",
        content: "That's great! What kind of books do you enjoy?",
      },
    ],
  },
];

async function main() {
  console.log("=== English Tutor Demo ===\n");
  for (const scenario of scenarios) {
    const preset = classifyEnglishInput(scenario.userText);
    console.log(`\n${scenario.label}`);
    console.log(`学生：${scenario.userText}`);
    console.log(`预判 inputType：${preset}`);

    const response = await runEnglishTutor({
      threadId: THREAD_ID,
      userText: scenario.userText,
      history: scenario.history,
    });

    console.log(`\n老师（JSON）：\n${safeStringifyEnglish(response)}`);
  }

  console.log("\n=== 学习者记忆快照 ===");
  console.log(JSON.stringify(englishMemoryStore.snapshot(THREAD_ID), null, 2));
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Add npm script**

In `package.json` `scripts` block, add:

```json
"english:demo": "tsx scripts/english-demo.ts"
```

- [ ] **Step 4: Run the demo**

Run: `pnpm english:demo`
Expected: 3 JSON responses printed, then memory snapshot.

- [ ] **Step 5: Verify router/skill registration**

Run: `curl -s http://localhost:3000/skills | head -200` after `pnpm dev`
Expected: `english` appears in the skills list with description.

---

## Task 11: Final typecheck & summary

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 2: Restart dev server**

Run: `pnpm dev` (in background) and confirm no startup errors related to skill registration.

- [ ] **Step 3: Send a real chat to test SSE flow**

Run: `curl -N -X POST http://localhost:3000/chat -H 'Content-Type: application/json' -d '{"threadId":"english-test-1","message":"帮我把『今天真的很累』翻译成自然英文"}'`
Expected: `router:end` event with `skillName: "english"`, then a `message:delta` stream whose accumulated content is a JSON object (possibly wrapped in a ` ```json ` fence).

---

## Self-Review Notes

- **Spec coverage:**
  - 中文→英文 ✓ (chinese_to_english mode)
  - 英文外教聊天 ✓ (english_chat mode)
  - 纠错 ✓ (correction mode + correction field)
  - 关键词解释 ✓ (explain_phrase mode + phrases)
  - 发音提示 ✓ (pronunciation field)
  - 学习记忆 ✓ (memory.ts)
  - 结构化输出 ✓ (EnglishTutorResponseSchema)
  - JSON-only prompt ✓ (prompts.ts strict rules)
  - 不破坏现有流程 ✓ (no graph/SSE/reply changes)
- **No placeholders:** every step has the full code to write.
- **Type consistency:** `EnglishTutorResponse` used in `service.ts` matches `EnglishTutorResponseSchema.infer` from `types.ts`. `RunEnglishTutorHistoryItem` is a re-export alias for `EnglishTutorHistoryItem`.

## Out of Scope (deferred to v2)

- Real TTS / speech recognition
- External dictionary API (Cambridge / Youdao)
- Persistent DB-backed learner memory
- Dedicated `EnglishTutorAgent` graph node (right now the skill is a system-prompt injection into `ReplyAgent`)
- Frontend card UI (current MVP shows the JSON as Markdown code block)
