import { ChatPromptTemplate } from "@langchain/core/prompts";
import { model } from "../../services/llm";
import { getSkillByName } from "../../skills";
import type { AgentRuntimeState } from "../../runtime/state";
import type { AgentDefinition } from "../base";

const SYSTEM_PROMPT = `你是一个最终回复 Agent（Reply Agent）。

你会收到完整的系统状态（state）。

你的职责：
1. 理解用户意图
2. 整合 plan / executionResults / decision / tool 结果
3. 用自然语言给出最终回答
4. 不要暴露内部字段名（如 plan、executionResults、decision）
5. 不要解释系统结构
6. 只输出用户可读内容
7. 如果是日常闲聊，直接自然地回复即可
8. 如果状态中包含任务执行结果（executionResults），把结果整理成连贯的回答
9. 如果状态中是 reject（用户取消），礼貌告知任务已取消
10. 如果状态中有错误信息，优先回复错误信息并建议用户修改提问`;

const buildChain = (skillPrompt: string) => {
  const system = skillPrompt ? `${SYSTEM_PROMPT}\n\n# 领域 skill 提示\n${skillPrompt}` : SYSTEM_PROMPT;
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", system],
    ["human", "完整系统状态如下：\n\n{state}\n\n请根据状态生成最终回复。"],
  ]);
  return prompt.pipe(model);
};

export const ReplyAgent: AgentDefinition = {
  name: "replyAgent",
  description: "整合状态，生成用户可读的最终回复",
  systemPrompt: SYSTEM_PROMPT,
  async invoke(state) {
    const skill = state.skillName ? getSkillByName(state.skillName) : undefined;
    const chain = buildChain(skill?.systemPrompt ?? "");
    const res = await chain.invoke({ state: JSON.stringify(state, null, 2) });
    return { messages: [res] };
  },
};
