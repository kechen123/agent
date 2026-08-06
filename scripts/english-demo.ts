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
